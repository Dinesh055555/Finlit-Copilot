// Tax engine for Indian listed equity, equity mutual funds and debt mutual funds.
// Rules: FY 2026-27. Figures exclude cess and surcharge (shown as a note in the UI).

export const TAX_RULES = {
  stcgEquityRate: 0.2,
  ltcgEquityRate: 0.125,
  ltcgExemption: 125000,
  equityLongTermMonths: 12,
  defaultSlabRate: 0.3,
};

/**
 * A holding has lots. Each lot: { cost, value, months }.
 * Selling `amount` (in rupees of current value) from a holding uses FIFO (oldest lot first).
 * Returns the lot slices sold.
 */
export function sliceHolding(holding, amount) {
  const lots = [...(holding.lots || [])].sort((a, b) => b.months - a.months);
  const out = [];
  let left = Math.min(amount, holding.value);
  for (const lot of lots) {
    if (left <= 0.0001) break;
    const take = Math.min(left, lot.value);
    const frac = lot.value > 0 ? take / lot.value : 0;
    out.push({ value: take, cost: lot.cost * frac, months: lot.months });
    left -= take;
  }
  return out;
}

function exitLoadFor(holding, slice) {
  if (holding.kind !== "mf") return 0;
  const pct = holding.exitLoadPct ?? 0;
  const months = holding.exitLoadMonths ?? 12;
  return slice.months <= months ? slice.value * (pct / 100) : 0;
}

function taxBucket(holding, slice) {
  if (holding.taxClass === "slab") return "slab";
  return slice.months > TAX_RULES.equityLongTermMonths ? "ltcg" : "stcg";
}

/**
 * sales: [{ holding, amount }]
 * opts: { slabRate, ltcgAlreadyUsed }
 * Returns a full, explainable breakdown.
 */
export function computeSaleTax(sales, opts = {}) {
  const slabRate = opts.slabRate ?? TAX_RULES.defaultSlabRate;
  const exemptionLeft = Math.max(0, TAX_RULES.ltcgExemption - (opts.ltcgAlreadyUsed || 0));

  const lines = [];
  let exitLoad = 0;
  let proceedsGross = 0;
  const gains = { slab: 0, stcg: 0, ltcg: 0 };
  const losses = { short: 0, long: 0 };

  for (const { holding, amount } of sales) {
    if (!amount || amount <= 0) continue;
    const slices = sliceHolding(holding, amount);
    let hLoad = 0;
    let hGain = 0;
    const buckets = new Set();
    for (const s of slices) {
      const load = exitLoadFor(holding, s);
      const gain = s.value - load - s.cost;
      const bucket = taxBucket(holding, s);
      buckets.add(bucket);
      hLoad += load;
      hGain += gain;
      if (gain >= 0) gains[bucket] += gain;
      else if (bucket === "ltcg") losses.long += -gain;
      else losses.short += -gain;
    }
    exitLoad += hLoad;
    proceedsGross += slices.reduce((a, s) => a + s.value, 0);
    lines.push({
      id: holding.id,
      name: holding.name,
      amount: slices.reduce((a, s) => a + s.value, 0),
      exitLoad: hLoad,
      gain: hGain,
      buckets: [...buckets],
    });
  }

  // Set-off. Short-term loss: slab gains first (highest rate), then 20% STCG, then LTCG.
  const steps = [];
  let st = losses.short;
  const net = { ...gains };
  const use = (from, label) => {
    if (st <= 0 || net[from] <= 0) return;
    const used = Math.min(st, net[from]);
    net[from] -= used;
    st -= used;
    steps.push({ text: `Short-term loss of ${Math.round(used)} offsets ${label}`, amount: used });
  };
  use("slab", "slab-rate gains (debt and liquid funds)");
  use("stcg", "short-term equity gains (20%)");
  use("ltcg", "long-term equity gains");
  // Long-term loss can only offset LTCG.
  let lt = losses.long;
  if (lt > 0 && net.ltcg > 0) {
    const used = Math.min(lt, net.ltcg);
    net.ltcg -= used;
    lt -= used;
    steps.push({ text: `Long-term loss of ${Math.round(used)} offsets long-term gains`, amount: used });
  }
  const carryForward = st + lt;

  const exemptUsed = Math.min(net.ltcg, exemptionLeft);
  const taxableLtcg = net.ltcg - exemptUsed;
  const tax = {
    slab: net.slab * slabRate,
    stcg: net.stcg * TAX_RULES.stcgEquityRate,
    ltcg: taxableLtcg * TAX_RULES.ltcgEquityRate,
  };
  const totalTax = tax.slab + tax.stcg + tax.ltcg;

  return {
    lines,
    proceedsGross,
    exitLoad,
    gains,
    losses,
    netAfterSetoff: net,
    setoffSteps: steps,
    carryForwardLoss: carryForward,
    ltcgExemptionUsed: exemptUsed,
    ltcgExemptionLeftAfter: exemptionLeft - exemptUsed,
    tax,
    totalTax,
    friction: exitLoad + totalTax,
    netProceeds: proceedsGross - exitLoad - totalTax,
    slabRate,
  };
}

export const round = (n) => Math.round(n);

// Pause & Plan engine: builds options, costs, charter checks, what-if matrix and a plain-language verdict.
import { computeSaleTax } from "./tax.js";

export const ASSUMPTIONS = { debtReturn: 0.07, parkedReturn: 0.065, upMove: 0.15, downMove: -0.1 };

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
const pct = (a, b) => (b > 0 ? (a / b) * 100 : 0);
const inr = (n) => "₹" + Math.round(n).toLocaleString("en-IN");

export function summarize(holdings) {
  const total = sum(holdings, (h) => h.value);
  const equity = sum(holdings.filter((h) => h.assetClass === "equity"), (h) => h.value);
  const debt = sum(holdings.filter((h) => h.assetClass === "debt"), (h) => h.value);
  const cash = sum(holdings.filter((h) => h.assetClass === "cash"), (h) => h.value);
  const prev = sum(holdings, (h) => h.value / (1 + (h.dayChangePct || 0) / 100));
  const stocks = holdings.filter((h) => h.kind === "stock" || h.kind === "etf");
  const topStock = stocks.sort((a, b) => b.value - a.value)[0];
  return {
    total,
    equity,
    debt,
    cash,
    safe: debt + cash,
    equityPct: pct(equity, total),
    safePct: pct(debt + cash, total),
    dayChange: total - prev,
    dayChangePct: prev > 0 ? ((total - prev) / prev) * 100 : 0,
    invested: sum(holdings, (h) => h.cost),
    topStock: topStock ? { id: topStock.id, name: topStock.name, weight: pct(topStock.value, total) } : null,
  };
}

function permutations(arr) {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

/**
 * Raise `amount` by selling from groups in order (e.g. cash, then debt, then equity).
 * Inside a group, all orderings are tried with the last holding partially sold,
 * and the ordering with the lowest total friction (exit load + tax) wins.
 * Ties go to selling larger holdings first.
 */
export function raiseAmount(holdings, amount, groups, taxOpts) {
  let sales = [];
  let need = amount;
  for (const group of groups) {
    if (need <= 0.5) break;
    const members = holdings.filter((h) => group.includes(h.assetClass) && h.value > 0);
    const groupTotal = sum(members, (h) => h.value);
    if (groupTotal <= need) {
      sales = sales.concat(members.map((h) => ({ holding: h, amount: h.value })));
      need -= groupTotal;
      continue;
    }
    const sorted = [...members].sort((a, b) => b.value - a.value);
    const perms = sorted.length <= 7 ? permutations(sorted) : [sorted];
    let best = null;
    for (const order of perms) {
      let left = need;
      const trial = [];
      for (const h of order) {
        if (left <= 0.5) break;
        const take = Math.min(left, h.value);
        trial.push({ holding: h, amount: take });
        left -= take;
      }
      const res = computeSaleTax([...sales, ...trial], taxOpts);
      if (!best || res.friction < best.res.friction - 0.5) best = { trial, res };
    }
    sales = sales.concat(best.trial);
    need = 0;
  }
  return sales;
}

function applySales(holdings, sales) {
  const sold = new Map();
  for (const s of sales) sold.set(s.holding.id, (sold.get(s.holding.id) || 0) + s.amount);
  return holdings
    .map((h) => {
      const amt = sold.get(h.id) || 0;
      if (!amt) return h;
      const frac = h.value > 0 ? (h.value - amt) / h.value : 0;
      return { ...h, value: h.value - amt, cost: h.cost * frac };
    })
    .filter((h) => h.value > 0.5);
}

function afterState(holdings, sales, destination, taxRes) {
  // destination: "debt" (rebalance), "parked" (exit to bank/FD), "spent" (withdrawn for a need)
  const remaining = applySales(holdings, sales);
  const s = summarize(remaining);
  const net = taxRes ? taxRes.netProceeds : 0;
  let equity = s.equity;
  let safe = s.safe;
  let parked = 0;
  if (destination === "debt") safe += net;
  if (destination === "parked") parked = net;
  const total = equity + safe;
  return {
    remaining,
    equity,
    safe,
    parked,
    total,
    equityPct: pct(equity, total),
    safePct: pct(safe, total),
    stockWeights: remaining
      .filter((h) => h.kind === "stock" || h.kind === "etf")
      .map((h) => ({ id: h.id, name: h.name, weight: pct(h.value, total) })),
  };
}

function whatIf(state, a = ASSUMPTIONS) {
  const v = (m) => state.equity * (1 + m) + state.safe * (1 + a.debtReturn) + state.parked * (1 + a.parkedReturn);
  return { up: v(a.upMove), down: v(a.downMove) };
}

function charterRows(charter, now, options) {
  const rows = [];
  const fmt = (n) => `${n.toFixed(1)}%`;
  const eqOk = (p) => p >= charter.equityMin - 0.05 && p <= charter.equityMax + 0.05;
  rows.push({
    rule: `Equity between ${charter.equityMin}% and ${charter.equityMax}%`,
    now: { value: fmt(now.equityPct), ok: eqOk(now.equityPct) },
    after: Object.fromEntries(options.map((o) => [o.id, o.after.total > 0 ? { value: fmt(o.after.equityPct), ok: eqOk(o.after.equityPct) } : { value: "All cash", ok: charter.equityMin === 0 }])),
  });
  if (charter.safeMin > 0) {
    rows.push({
      rule: `Debt plus cash at least ${charter.safeMin}%`,
      now: { value: fmt(now.safePct), ok: now.safePct >= charter.safeMin - 0.05 },
      after: Object.fromEntries(options.map((o) => [o.id, { value: o.after.total > 0 ? fmt(o.after.safePct) : "100%", ok: o.after.total > 0 ? o.after.safePct >= charter.safeMin - 0.05 : true }])),
    });
  }
  if (charter.singleStockMax) {
    const nowTop = now.topStock;
    rows.push({
      rule: `No single stock above ${charter.singleStockMax}%`,
      now: { value: nowTop ? `${nowTop.weight.toFixed(1)}% (${nowTop.name})` : "No stocks", ok: !nowTop || nowTop.weight <= charter.singleStockMax + 0.05 },
      after: Object.fromEntries(
        options.map((o) => {
          const top = [...o.after.stockWeights].sort((a, b) => b.weight - a.weight)[0];
          return [o.id, { value: top ? `${top.weight.toFixed(1)}%` : "None", ok: !top || top.weight <= charter.singleStockMax + 0.05 }];
        })
      ),
    });
  }
  if (charter.needAmount > 0) {
    rows.push({
      rule: `Money needed within 12 months (${inr(charter.needAmount)}) stays out of equity`,
      now: { value: `${inr(Math.min(now.safe, charter.needAmount))} of ${inr(charter.needAmount)} is safe`, ok: now.safe >= charter.needAmount },
      after: Object.fromEntries(options.map((o) => [o.id, { value: o.covers ? "Covered" : "Not covered", ok: !!o.covers }])),
    });
  }
  return rows;
}

export function marketContext({ market, news, holdings, alert, profileFromPeak }) {
  const relevant = (news || []).filter((n) => n.classification);
  const negMacro = relevant.filter((n) => n.classification.scope !== "company_specific" && (n.classification.sentiment ?? -0.3) < 0);
  const structural = relevant.filter((n) => n.classification.class === "structural" && n.matchedHoldingIds?.length);
  const event = alert?.newsId ? relevant.find((n) => n.id === alert.newsId) : structural[0];
  const companySpecific = !!(event && event.classification.scope === "company_specific");
  const niftyFall = market?.nifty?.changePct ?? 0;
  const sources = new Set(negMacro.map((n) => n.publisher)).size;
  const avgSent = negMacro.length ? negMacro.reduce((a, n) => a + (n.classification.sentiment ?? -0.3), 0) / negMacro.length : 0;

  let label;
  let confidence;
  if (companySpecific) {
    label = "Company-specific event";
    confidence = event.classification.confidence ?? 0.75;
  } else {
    label = "Market-wide macro move";
    confidence = 0.6 + (niftyFall <= -2 ? 0.1 : 0) + (structural.length === 0 ? 0.1 : 0) + Math.min(0.14, 0.02 * negMacro.length);
  }
  const s = summarize(holdings);
  return {
    label,
    companySpecific,
    confidence: Math.min(0.97, confidence),
    confidenceFormula: companySpecific
      ? "Confidence comes from the news classifier for this headline."
      : "60% base, plus 10% if Nifty is down 2% or more, plus 10% if no company-specific red flags on your holdings, plus 2% per negative market-wide headline (max 14%).",
    event,
    signals: [
      { name: "Scope", value: companySpecific ? "Company-specific" : "Market-wide", score: companySpecific ? 0.9 : 0.15 },
      { name: "Fundamentals of your holdings hit", value: structural.length ? `Yes (${structural.length} headline${structural.length > 1 ? "s" : ""})` : "No", score: structural.length ? 0.9 : 0.1 },
      { name: "Persistence", value: `${negMacro.length} headlines from ${sources} source${sources === 1 ? "" : "s"}`, score: Math.min(1, negMacro.length / 10) },
      { name: "Sentiment intensity", value: avgSent ? avgSent.toFixed(2) : "n/a", score: Math.min(1, Math.abs(avgSent)) },
    ],
    portfolioVsNifty: {
      portfolioDayPct: s.dayChangePct,
      niftyDayPct: niftyFall,
      portfolioFromPeakPct: profileFromPeak ?? null,
      niftyFromHighPct: market?.nifty?.fromHighPct ?? null,
    },
    wouldChange: companySpecific
      ? "A clarification from the company or regulator, or the order being stayed, would lower the severity."
      : "A rating downgrade, default or regulatory action at a company you hold would change this from market-wide to specific.",
  };
}

/**
 * input: { holdings, charter, person, reason, needAmount, alert, market, news, profileFromPeak, assumptions }
 */
export function buildPlan(input) {
  const { holdings, charter, person } = input;
  const reason = input.reason || person?.defaultReason || "worried";
  const a = { ...ASSUMPTIONS, ...(input.assumptions || {}) };
  const taxOpts = { slabRate: (charter.slabRate ?? 30) / 100, ltcgAlreadyUsed: charter.ltcgAlreadyUsed || 0 };
  const now = summarize(holdings);
  const ctx = marketContext(input);
  const options = [];

  const addOption = (o) => {
    o.cost = o.tax ? o.tax.friction : 0;
    o.whatIf = whatIf(o.after, a);
    options.push(o);
  };

  // Exit all
  const exitSales = holdings.map((h) => ({ holding: h, amount: h.value }));
  const exitTax = computeSaleTax(exitSales, taxOpts);
  const needAmount = reason === "need" ? input.needAmount || charter.needAmount || 0 : 0;
  const exitAfter = afterState(holdings, exitSales, "parked", exitTax);
  if (needAmount > 0) exitAfter.parked = Math.max(0, exitAfter.parked - needAmount);
  addOption({
    id: "exit_all",
    label: "Exit everything",
    detail: `Sell all ${holdings.length} holdings. Net proceeds ${inr(exitTax.netProceeds)}.`,
    sales: exitSales,
    tax: exitTax,
    after: exitAfter,
    covers: true,
  });

  // Stay
  addOption({ id: "stay", label: "Keep everything as is", detail: "No change. Your SIPs continue.", sales: [], tax: null, after: afterState(holdings, [], "parked", null), covers: needAmount === 0 ? undefined : now.safe >= needAmount });

  // Rebalance to plan
  const excess = now.equity - (charter.equityMax / 100) * now.total;
  if (excess > 1000 && reason !== "need") {
    const sales = raiseAmount(holdings, excess, [["equity"]], taxOpts);
    const tax = computeSaleTax(sales, taxOpts);
    const from = sales.map((s) => `${inr(s.amount)} from ${s.holding.name}`).join(", ");
    addOption({
      id: "rebalance",
      label: "Rebalance to my plan",
      detail: `Move ${inr(excess)} from equity to debt: ${from}.`,
      sales,
      tax,
      moveAmount: excess,
      after: afterState(holdings, sales, "debt", tax),
    });
  }

  // Withdraw only what I need, tax-smart (safe assets first, then cheapest equity units)
  if (needAmount > 0) {
    const sales = raiseAmount(holdings, Math.min(needAmount, now.total), [["cash"], ["debt"], ["equity"]], taxOpts);
    const tax = computeSaleTax(sales, taxOpts);
    const from = sales.map((s) => `${inr(s.amount)} from ${s.holding.name}`).join(", ");
    addOption({
      id: "withdraw_need",
      label: `Withdraw only ${inr(needAmount)}, tax-smart`,
      detail: `Safe assets first, then the equity units that cost least to sell: ${from}.`,
      sales,
      tax,
      after: afterState(holdings, sales, "spent", tax),
      covers: true,
    });
  }

  // Structural event on a holding: reduce to limit, or exit that holding
  const eventHolding = ctx.companySpecific && ctx.event ? holdings.find((h) => ctx.event.matchedHoldingIds?.includes(h.id)) : null;
  if (eventHolding) {
    const cap = (charter.singleStockMax || 10) / 100;
    const toCap = (eventHolding.value - cap * now.total) / (1 - cap);
    if (toCap > 1000) {
      const sales = [{ holding: eventHolding, amount: toCap }];
      const tax = computeSaleTax(sales, taxOpts);
      addOption({ id: "reduce_cap", label: `Reduce ${eventHolding.name} to my ${charter.singleStockMax}% limit`, detail: `Sell ${inr(toCap)} of ${eventHolding.name}. Proceeds go to your liquid fund.`, sales, tax, after: afterState(holdings, sales, "debt", tax) });
    }
    const sales = [{ holding: eventHolding, amount: eventHolding.value }];
    const tax = computeSaleTax(sales, taxOpts);
    addOption({ id: "exit_holding", label: `Exit ${eventHolding.name} only`, detail: `Sell all ${inr(eventHolding.value)} of ${eventHolding.name}. Proceeds go to your liquid fund.`, sales, tax, after: afterState(holdings, sales, "debt", tax) });
  }

  // Remind me later
  addOption({ id: "remind", label: "Remind me in 3 days", detail: "Nothing changes now. We will bring you back to this plan with fresh numbers.", sales: [], tax: null, after: afterState(holdings, [], "parked", null) });

  // Pick hero and write the verdict
  const byId = Object.fromEntries(options.map((o) => [o.id, o]));
  const exit = byId.exit_all;
  let hero = "stay";
  let verdict = [];
  let tone = "calm";

  if (reason === "moving") {
    hero = "exit_all";
    verdict = [`Here is exactly what moving everything costs today: ${inr(exit.cost)} in exit load and tax, leaving ${inr(exit.tax.netProceeds)}.`, "No advice from us on this one. It is your call."];
  } else if (reason === "need" && byId.withdraw_need) {
    hero = "withdraw_need";
    const w = byId.withdraw_need;
    verdict = [
      `You need ${inr(needAmount)}, so withdrawing is the right move. The question is only where it comes from.`,
      `Taking it from your safe assets first, then from the equity units that cost least to sell, costs ${inr(w.cost)}.`,
      `Your remaining ${inr(w.after.total)} keeps working for your long-term goal instead of leaving the market for no reason.`,
    ];
  } else if (reason === "goal") {
    hero = "exit_all";
    const taxableLtcg = Math.max(0, exit.tax.netAfterSetoff.ltcg - exit.tax.ltcgExemptionUsed);
    const splitSave = Math.min(taxableLtcg, 125000) * 0.125;
    verdict = [
      "Congratulations on reaching your goal. Withdrawing is reasonable.",
      splitSave > 0
        ? `Tip: split the redemption so part falls before 31 March and part after 1 April. You use the 1.25 lakh LTCG exemption twice and save about ${inr(splitSave)}.`
        : `Your long-term gains fit inside this year's tax-free limit, so a single withdrawal is efficient. Total cost ${inr(exit.cost)}.`,
    ];
  } else if (eventHolding) {
    hero = byId.reduce_cap ? "reduce_cap" : "exit_holding";
    tone = "alert";
    const w = (eventHolding.value / now.total) * 100;
    verdict = [
      `This is different from a normal market fall. The news is specific to ${eventHolding.name} and touches its fundamentals.`,
      `It is ${w.toFixed(1)}% of your portfolio, above your own ${charter.singleStockMax}% single-stock limit. Reducing or exiting this one holding is consistent with your plan.`,
      `Exiting it fully costs ${inr(byId.exit_holding.cost)}. Your other holdings are not affected by this news, so exiting everything is not needed.`,
    ];
  } else if (byId.rebalance) {
    hero = "rebalance";
    const r = byId.rebalance;
    const lossIfRecovers = byId.stay.whatIf.up - exit.whatIf.up;
    verdict = [
      `This fall is ${ctx.companySpecific ? "specific" : "market-wide"} and your holdings are moving with Nifty, so nothing is broken in your funds.`,
      `You feel it more because you are at ${now.equityPct.toFixed(0)}% equity, above the ${charter.equityMax}% you set. Moving ${inr(r.moveAmount)} to debt brings you back to plan for ${inr(r.cost)}.`,
      `Exiting everything costs only ${inr(exit.cost)} in tax and load, but about ${inr(lossIfRecovers)} if markets recover 15% in a year. In a crash, tax is not your big cost. Timing is.`,
    ];
  } else {
    hero = "stay";
    const lossIfRecovers = byId.stay.whatIf.up - exit.whatIf.up;
    verdict = [
      `This fall is ${ctx.companySpecific ? "specific" : "market-wide"} and your allocation is inside your own plan (${now.equityPct.toFixed(0)}% equity vs ${charter.equityMin} to ${charter.equityMax}%).`,
      `Exiting everything costs ${inr(exit.cost)} now and about ${inr(lossIfRecovers)} if markets recover 15% in a year. Staying the course fits the plan you set.`,
    ];
  }

  // Order: hero first, exit_all always present and visible
  const order = [hero, ...options.map((o) => o.id).filter((id) => id !== hero)];
  const ordered = order.map((id) => byId[id]).filter(Boolean);

  const keyNumbers = [
    { label: "Cost to exit everything today", value: inr(exit.cost), sub: `Exit load ${inr(exit.tax.exitLoad)} + tax ${inr(exit.tax.totalTax)}` },
    { label: "Your plan", value: `${now.equityPct.toFixed(0)}% equity`, sub: `Your range: ${charter.equityMin} to ${charter.equityMax}%`, warn: now.equityPct > charter.equityMax + 0.05 || now.equityPct < charter.equityMin - 0.05 },
    reason === "need" && byId.withdraw_need
      ? { label: "Cost of withdrawing only what you need", value: inr(byId.withdraw_need.cost), sub: `Keeps ${inr(byId.withdraw_need.after.total)} invested` }
      : { label: "What exiting costs if markets recover 15%", value: inr(byId.stay.whatIf.up - exit.whatIf.up), sub: "Versus staying invested, 12 months" },
  ];

  return {
    reason,
    tone,
    hero,
    verdict,
    keyNumbers,
    now,
    context: ctx,
    options: ordered.map((o) => ({
      id: o.id,
      label: o.label,
      detail: o.detail,
      cost: o.cost,
      hero: o.id === hero,
      sales: o.sales.map((s) => ({ id: s.holding.id, name: s.holding.name, amount: s.amount, kind: s.holding.kind, tradingsymbol: s.holding.tradingsymbol, exchange: s.holding.exchange, quantityHeld: s.holding.quantity, value: s.holding.value })),
      tax: o.tax,
      after: { total: o.after.total, equityPct: o.after.equityPct, safePct: o.after.safePct, parked: o.after.parked },
      whatIf: o.whatIf,
    })),
    charter: charterRows(charter, now, options),
    assumptions: a,
    disclaimer:
      "Decision support based on your data, your own plan and public news. Not investment advice. FinLit earns the same whether you stay or exit. You make the final decision.",
    taxNote: "Tax shown before 4% cess and surcharge. Exit load reduces sale value before gains are computed.",
  };
}

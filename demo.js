// Demo portfolios. Numbers are verified acceptance values (see test/tax.test.js).

const mk = (h) => ({
  quantity: null,
  exchange: h.kind === "stock" ? "NSE" : "MF",
  lots: [{ cost: h.cost, value: h.value, months: h.months }],
  lotsEstimated: false,
  exitLoadMonths: 12,
  ...h,
});

export const DEMO_MARKET = {
  source: "Demo market (static)",
  nifty: { last: 22310.4, changePct: -3.4, fromHighPct: -14.2 },
  vix: { last: 24.8, changePct: 18.6 },
  portfolioFromPeakPct: null,
  asOf: null,
};

export const DEMO_PROFILES = {
  rohan: {
    id: "rohan",
    label: "Rohan (demo)",
    person: {
      name: "Rohan",
      age: 32,
      city: "Bengaluru",
      role: "Software engineer",
      goal: "Home down payment of 25 lakh in 5 years",
      horizonYears: 5,
      risk: "Moderate",
      sip: 25000,
      defaultReason: "worried",
    },
    charter: {
      equityMin: 60,
      equityMax: 80,
      safeMin: 20,
      singleStockMax: 10,
      slabRate: 30,
      ltcgAlreadyUsed: 0,
      needAmount: 0,
      needDate: "",
      rules: [
        "Rebalance when my equity drifts more than 5 points outside my range.",
        "Do not sell everything on a single bad day.",
      ],
      hardFloor: 0,
      holdingDropFloorPct: 0,
    },
    portfolioFromPeakPct: -14.8,
    holdings: [
      mk({ id: "r1", symbol: "FLEXICAP", name: "Flexi Cap Fund (Direct)", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 400000, value: 460000, months: 26, exitLoadPct: 1, beta: 1.0, dayChangePct: -3.3, amc: "AMC A" }),
      mk({ id: "r2", symbol: "MIDCAP", name: "Mid Cap Fund (Direct)", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 300000, value: 270000, months: 8, exitLoadPct: 1, beta: 1.2, dayChangePct: -4.1, amc: "AMC B" }),
      mk({ id: "r3", symbol: "NIFTYIDX", name: "Nifty 50 Index Fund", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 250000, value: 310000, months: 36, exitLoadPct: 0, beta: 1.0, dayChangePct: -3.4, amc: "AMC C" }),
      mk({ id: "r4", symbol: "SMALLCAP", name: "Small Cap Fund (Direct)", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 180000, value: 200000, months: 10, exitLoadPct: 1, beta: 1.4, dayChangePct: -4.6, amc: "AMC A" }),
      mk({ id: "r5", symbol: "HDFCBANK", name: "HDFC Bank", kind: "stock", assetClass: "equity", taxClass: "equity", cost: 100000, value: 110000, months: 5, exitLoadPct: 0, beta: 1.0, dayChangePct: -2.9, tradingsymbol: "HDFCBANK" }),
      mk({ id: "r6", symbol: "SHORTDUR", name: "Short Duration Debt Fund", kind: "mf", assetClass: "debt", taxClass: "slab", cost: 120000, value: 130000, months: 20, exitLoadPct: 0, beta: 0, dayChangePct: 0.05, amc: "AMC C" }),
      mk({ id: "r7", symbol: "LIQUID", name: "Liquid Fund", kind: "mf", assetClass: "cash", taxClass: "slab", cost: 20000, value: 20000, months: 3, exitLoadPct: 0, beta: 0, dayChangePct: 0.01, amc: "AMC B" }),
    ],
  },
  meera: {
    id: "meera",
    label: "Meera (demo)",
    person: {
      name: "Meera",
      age: 31,
      city: "Pune",
      role: "Marketing manager",
      goal: "Wedding in March 2027 (needs 4 lakh), then retirement",
      horizonYears: 25,
      risk: "Aggressive for long-term money",
      sip: 15000,
      defaultReason: "need",
    },
    charter: {
      equityMin: 50,
      equityMax: 100,
      safeMin: 0,
      singleStockMax: 15,
      slabRate: 30,
      ltcgAlreadyUsed: 0,
      needAmount: 400000,
      needDate: "2027-03-15",
      rules: ["Money I need within 12 months stays out of equity."],
      hardFloor: 0,
      holdingDropFloorPct: 0,
    },
    portfolioFromPeakPct: -12.9,
    holdings: [
      mk({ id: "m1", symbol: "LARGECAP", name: "Large Cap Fund (Direct)", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 300000, value: 360000, months: 30, exitLoadPct: 0, beta: 0.95, dayChangePct: -3.2, amc: "AMC D" }),
      mk({ id: "m2", symbol: "FLEXICAP", name: "Flexi Cap Fund (Direct)", kind: "mf", assetClass: "equity", taxClass: "equity", cost: 200000, value: 185000, months: 7, exitLoadPct: 1, beta: 1.05, dayChangePct: -3.5, amc: "AMC E" }),
      mk({ id: "m3", symbol: "SHORTDUR", name: "Short Duration Debt Fund", kind: "mf", assetClass: "debt", taxClass: "slab", cost: 150000, value: 162000, months: 18, exitLoadPct: 0, beta: 0, dayChangePct: 0.04, amc: "AMC D" }),
      mk({ id: "m4", symbol: "LIQUID", name: "Liquid Fund", kind: "mf", assetClass: "cash", taxClass: "slab", cost: 92000, value: 93000, months: 2, exitLoadPct: 0, beta: 0, dayChangePct: 0.01, amc: "AMC E" }),
    ],
  },
};

// Fictional company used only in the alarm drill. Clearly labelled in the UI.
export const DRILL_HOLDING = {
  id: "drill1",
  symbol: "VARDHANFIN",
  name: "Vardhan Fintech Ltd (fictional, drill)",
  kind: "stock",
  assetClass: "equity",
  taxClass: "equity",
  cost: 160000,
  value: 200000,
  months: 9,
  exitLoadPct: 0,
  beta: 1.3,
  dayChangePct: -9.8,
  exchange: "NSE",
  lots: [{ cost: 160000, value: 200000, months: 9 }],
  lotsEstimated: false,
  exitLoadMonths: 12,
  drill: true,
};

export const DRILL_NEWS = {
  id: "drill-news-1",
  title: "DRILL: Regulator issues interim order barring Vardhan Fintech (fictional) from new lending; auditor flags irregularities",
  link: "",
  publisher: "FinLit Drill",
  publishedAt: null,
  symbols: ["VARDHANFIN"],
  classification: {
    scope: "company_specific",
    event_type: "regulatory",
    fundamental_impact: "high",
    class: "structural",
    confidence: 0.9,
    sentiment: -0.85,
    one_line_reason: "Regulatory ban on core business plus audit concerns directly hit earnings and governance.",
    source: "drill",
  },
  drill: true,
};

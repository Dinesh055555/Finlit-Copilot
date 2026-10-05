import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSaleTax } from "./tax.js";
import { buildPlan } from "./planner.js";
import { DEMO_PROFILES, DEMO_MARKET, DRILL_HOLDING, DRILL_NEWS } from "./demo.js";

const R = DEMO_PROFILES.rohan;
const M = DEMO_PROFILES.meera;
const r = (n) => Math.round(n);

test("Rohan: exit everything costs 5,760 and leaves 14,94,240", () => {
  const res = computeSaleTax(R.holdings.map((h) => ({ holding: h, amount: h.value })), { slabRate: 0.3 });
  assert.equal(r(res.exitLoad), 4700);
  assert.equal(r(res.totalTax), 1060);
  assert.equal(r(res.friction), 5760);
  assert.equal(r(res.netProceeds), 1494240);
  assert.equal(r(res.ltcgExemptionUsed), 120000);
});

test("Rohan: plan picks rebalance of 1,50,000 from Flexi Cap at zero cost", () => {
  const plan = buildPlan({ holdings: R.holdings, charter: R.charter, person: R.person, reason: "worried", market: DEMO_MARKET, news: [] });
  assert.equal(plan.hero, "rebalance");
  const reb = plan.options.find((o) => o.id === "rebalance");
  assert.equal(r(reb.cost), 0);
  assert.equal(reb.sales.length, 1);
  assert.equal(reb.sales[0].id, "r1");
  assert.equal(r(reb.sales[0].amount), 150000);
  assert.equal(r(reb.after.equityPct), 80);
});

test("Rohan: what-if matrix matches the verified numbers", () => {
  const plan = buildPlan({ holdings: R.holdings, charter: R.charter, person: R.person, reason: "worried", market: DEMO_MARKET, news: [] });
  const by = Object.fromEntries(plan.options.map((o) => [o.id, o]));
  assert.equal(r(by.stay.whatIf.up), 1713000);
  assert.equal(r(by.stay.whatIf.down), 1375500);
  assert.equal(r(by.rebalance.whatIf.up), 1701000);
  assert.equal(r(by.rebalance.whatIf.down), 1401000);
  assert.equal(r(by.exit_all.whatIf.up), 1591366);
  assert.equal(r(by.exit_all.whatIf.down), 1591366);
});

test("Meera: tax-smart withdrawal of 4,00,000 costs 1,450", () => {
  const plan = buildPlan({ holdings: M.holdings, charter: M.charter, person: M.person, reason: "need", needAmount: 400000, market: DEMO_MARKET, news: [] });
  assert.equal(plan.hero, "withdraw_need");
  const w = plan.options.find((o) => o.id === "withdraw_need");
  assert.equal(r(w.cost), 1450);
  assert.equal(r(w.tax.totalTax), 0);
  assert.equal(r(w.tax.carryForwardLoss), 207);
  const amounts = Object.fromEntries(w.sales.map((s) => [s.id, r(s.amount)]));
  assert.deepEqual(amounts, { m4: 93000, m3: 162000, m2: 145000 });
  assert.equal(r(w.after.total), 400000);
});

test("Meera: exit everything costs 1,850", () => {
  const res = computeSaleTax(M.holdings.map((h) => ({ holding: h, amount: h.value })), { slabRate: 0.3 });
  assert.equal(r(res.friction), 1850);
});

test("Drill: structural news on a fictional holding makes reduce the hero", () => {
  const holdings = [...R.holdings, DRILL_HOLDING];
  const news = [{ ...DRILL_NEWS, matchedHoldingIds: ["drill1"] }];
  const plan = buildPlan({ holdings, charter: R.charter, person: R.person, reason: "alert", market: DEMO_MARKET, news, alert: { newsId: DRILL_NEWS.id } });
  assert.equal(plan.context.companySpecific, true);
  assert.equal(plan.hero, "reduce_cap");
  const red = plan.options.find((o) => o.id === "reduce_cap");
  assert.equal(r(red.sales[0].amount), 33333);
});

// News classifier: Claude API when a key is set, with a transparent rule-based fallback.
import { config, isConfigured } from "./config.js";
import { fetchWithTimeout } from "./util.js";

const STRUCTURAL = /(fraud|forensic|sebi (order|bars|ban|probe|penalt|interim)|\bbars?\b.*from|\bban(ned|s)?\b|\bed raid|\braid(s|ed)?\b|default(s|ed)?\b|insolven|\bnclt\b|downgrade|auditor (resign|quits|flags)|resigns as auditor|(ceo|md|cfo|chairman) (resign|quits|steps down)|pledge invoked|lower circuit|money laundering|whistleblower|irregularit|show.cause|licen[cs]e (cancel|suspend)|rbi (bars|restricts|curbs|penal))/i;
const EARNINGS = /(\bq[1-4]\b|results|net profit|profit (falls|rises|jumps|drops|slumps)|revenue|earnings|ebitda|guidance|margin)/i;
const MACRO = /(\brbi\b|repo|inflation|\bcpi\b|\bwpi\b|\bgdp\b|\bfii|\bfpi|\bfed\b|crude|rupee|global|wall street|us market|election|budget|tariff|yield|sensex|nifty|market|monsoon|liquidity|geopolit|war\b)/i;
const NEG = /(fall|falls|fell|slump|crash|tank|plunge|drop|declin|loss|weak|cut|sell-?off|lower|bleed|tumble|slide|fear|probe|worst|selling|outflow|red\b|down\b|hit\b|plummet|sink)/i;
const POS = /(rise|rises|rally|gain|surge|jump|record|beat|strong|green|up\b|soar|upgrade|inflow|buy\b|high\b)/i;

export function ruleClassify(item) {
  const t = item.title || "";
  const company = (item.matchedHoldingIds || []).length > 0;
  const structural = STRUCTURAL.test(t);
  const earnings = EARNINGS.test(t);
  const macro = MACRO.test(t);
  const neg = NEG.test(t);
  const pos = POS.test(t);
  const sentiment = neg && !pos ? -0.6 : pos && !neg ? 0.5 : neg && pos ? -0.1 : 0;
  let scope = company ? "company_specific" : macro ? "market_wide" : "sector";
  let cls = "noise";
  let event = macro ? "macro" : "other";
  let impact = "none";
  if (structural && company) {
    cls = "structural";
    event = /downgrade/i.test(t) ? "rating_change" : /fraud|irregular|forensic|whistle/i.test(t) ? "fraud" : /default|insolven|nclt/i.test(t) ? "default" : /resign|quits|steps down/i.test(t) ? "management_exit" : "regulatory";
    impact = "high";
  } else if (earnings && company) {
    cls = "material";
    event = "earnings";
    impact = sentiment < 0 ? "low" : "none";
  } else if (structural) {
    cls = "material";
    event = "regulatory";
    impact = "low";
  }
  const confidence = cls === "structural" ? 0.78 : cls === "material" ? 0.65 : 0.7;
  return {
    scope,
    event_type: event,
    fundamental_impact: impact,
    class: cls,
    confidence,
    sentiment,
    one_line_reason:
      cls === "structural"
        ? "Headline mentions a governance, regulatory or credit event at a company you hold."
        : cls === "material"
        ? "Company or sector news that may matter but does not by itself change fundamentals."
        : macro
        ? "Market-wide or macro news. Affects most stocks, not a problem specific to your holdings."
        : "General business news.",
    source: "rules",
  };
}

const SYSTEM = `You classify Indian financial news headlines for a retail investor decision-support tool.
For each headline return an object with:
- id (copy from input)
- scope: "market_wide" | "sector" | "company_specific"
- event_type: "macro" | "flows" | "earnings" | "regulatory" | "governance" | "fraud" | "default" | "rating_change" | "management_exit" | "other"
- fundamental_impact: "none" | "low" | "high"  (impact on the named company's long-term fundamentals)
- class: "noise" | "material" | "structural"
  noise = market-wide or temporary, no change to fundamentals
  material = relevant company or sector news, fundamentals mostly intact
  structural = company-specific event that plausibly damages fundamentals (fraud, regulatory ban, default, downgrade, auditor or CEO exit)
- confidence: number 0 to 1
- sentiment: number -1 to 1
- one_line_reason: max 25 words, plain English, no advice, no buy or sell instructions
Return ONLY a JSON array. Be conservative: use "structural" only when the headline clearly states such an event.`;

export async function aiClassify(items) {
  if (!isConfigured.ai() || !items.length) return null;
  const input = items.map((i) => ({ id: i.id, headline: i.title, publisher: i.publisher, related_holdings: i.matchedNames || [] }));
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.ai.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.ai.model,
        max_tokens: 2000,
        temperature: 0,
        system: SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(input) }],
      }),
    },
    20000
  );
  if (!res.ok) throw new Error(`Claude API ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  const arr = JSON.parse(text.slice(start, end + 1));
  const out = {};
  for (const o of arr) if (o && o.id) out[o.id] = { ...o, source: "claude" };
  return out;
}

export async function classifyBatch(items) {
  const result = {};
  let ai = null;
  try {
    ai = await aiClassify(items.slice(0, 20));
  } catch (e) {
    console.warn("AI classifier unavailable, using rules:", e.message);
  }
  for (const it of items) result[it.id] = ai?.[it.id] || ruleClassify(it);
  return result;
}

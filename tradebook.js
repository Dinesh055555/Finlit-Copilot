// Parses a Zerodha Console tradebook CSV into FIFO lots per symbol (oldest first).
function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cells = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (q && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = !q;
      } else if (ch === "," && !q) {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    rows.push(cells.map((c) => c.trim()));
  }
  return rows;
}

export function tradebookToLots(text, now = new Date()) {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error("The file looks empty.");
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (name) => head.indexOf(name);
  const iSym = col("symbol");
  const iDate = col("trade_date");
  const iType = col("trade_type");
  const iQty = col("quantity");
  const iPrice = col("price");
  if ([iSym, iDate, iType, iQty, iPrice].some((i) => i < 0)) {
    throw new Error("Expected Zerodha tradebook columns: symbol, trade_date, trade_type, quantity, price.");
  }
  const trades = rows
    .slice(1)
    .map((r) => ({ sym: r[iSym], date: new Date(r[iDate]), type: r[iType].toLowerCase(), qty: Number(r[iQty]), price: Number(r[iPrice]) }))
    .filter((t) => t.sym && !isNaN(t.date) && t.qty > 0)
    .sort((a, b) => a.date - b.date);

  const book = {};
  for (const t of trades) {
    book[t.sym] ||= [];
    if (t.type === "buy") book[t.sym].push({ qty: t.qty, price: t.price, date: t.date });
    else {
      let left = t.qty;
      while (left > 0 && book[t.sym].length) {
        const lot = book[t.sym][0];
        const used = Math.min(left, lot.qty);
        lot.qty -= used;
        left -= used;
        if (lot.qty <= 0) book[t.sym].shift();
      }
    }
  }
  const out = {};
  for (const [sym, lots] of Object.entries(book)) {
    const live = lots.filter((l) => l.qty > 0);
    if (!live.length) continue;
    out[sym] = live.map((l) => ({
      qty: l.qty,
      price: l.price,
      date: l.date.toISOString().slice(0, 10),
      months: Math.max(0, (now - l.date) / (1000 * 60 * 60 * 24 * 30.4375)),
    }));
  }
  return out;
}

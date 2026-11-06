const { DATA, SYMBOLS, alpaca, guard } = require("./_alpaca");
module.exports = guard(async (req, res) => {
  const want = String((req.query && req.query.symbols) || "").split(",").filter(s => SYMBOLS.includes(s));
  const list = want.length ? want : SYMBOLS;
  const d = await alpaca(DATA, "/stocks/quotes/latest?feed=iex&symbols=" + list.join(","));
  const out = {};
  for (const s of list) {
    const q = d.quotes && d.quotes[s];
    if (q && q.ap > 0 && q.bp > 0) out[s] = { bid: q.bp, ask: q.ap, mid: (q.ap + q.bp) / 2, t: q.t };
  }
  res.status(200).json({ feed: "iex", quotes: out });
});

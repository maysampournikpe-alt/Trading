const { DATA, SYMBOLS, alpaca, guard } = require("./_alpaca");
module.exports = guard(async (req, res) => {
  const d = await alpaca(DATA, "/stocks/quotes/latest?feed=iex&symbols=" + SYMBOLS.join(","));
  const out = {};
  for (const s of SYMBOLS) {
    const q = d.quotes && d.quotes[s];
    if (q && q.ap > 0 && q.bp > 0) out[s] = { bid: q.bp, ask: q.ap, mid: (q.ap + q.bp) / 2, t: q.t };
  }
  res.status(200).json({ feed: "iex", quotes: out });
});

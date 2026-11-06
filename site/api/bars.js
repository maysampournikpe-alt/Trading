// 1-minute bars for the chart page (real data, IEX feed). Same passcode as the other trader routes.
const { DATA, SYMBOLS, alpaca, guard } = require("./_alpaca");
module.exports = guard(async (req, res) => {
  const symbol = String((req.query && req.query.symbol) || "SPY");
  if (!SYMBOLS.includes(symbol)) return res.status(400).json({ error: "symbol not on the allowlist" });
  const limit = Math.min(Math.max(Number((req.query && req.query.limit) || 300), 1), 1000);
  const start = new Date(Date.now() - 4 * 864e5).toISOString(); // covers weekends
  const d = await alpaca(DATA, `/stocks/${symbol}/bars?timeframe=1Min&feed=iex&sort=desc&limit=${limit}&start=${encodeURIComponent(start)}`);
  const bars = (d.bars || []).reverse().map(b => ({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
  res.status(200).json({ symbol, feed: "iex", bars });
});

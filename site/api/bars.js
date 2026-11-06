// 1-minute bars for the chart page (real data, IEX feed). Same passcode as the other trader routes.
// ?symbol=SPY&limit=400 for the chart, or ?symbol=SPY&days=20 for a backtest (paged, up to 30,000 bars).
const { DATA, cleanSymbol, alpaca, guard } = require("./_alpaca");
module.exports = guard(async (req, res) => {
  const q = req.query || {};
  const symbol = cleanSymbol(q.symbol || "SPY");
  if (!symbol) return res.status(400).json({ error: "that does not look like a ticker" });
  const days = Math.min(Math.max(Number(q.days) || 0, 0), 60);
  const map = b => ({ time: Math.floor(Date.parse(b.t) / 1000), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v });
  if (!days) {
    const limit = Math.min(Math.max(Number(q.limit) || 300, 1), 1000);
    const start = new Date(Date.now() - 4 * 864e5).toISOString(); // covers weekends
    const d = await alpaca(DATA, `/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Min&feed=iex&sort=desc&limit=${limit}&start=${encodeURIComponent(start)}`);
    return res.status(200).json({ symbol, feed: "iex", bars: (d.bars || []).reverse().map(map) });
  }
  const start = new Date(Date.now() - days * 864e5).toISOString();
  let token = "", out = [];
  for (let page = 0; page < 3; page++) {
    const d = await alpaca(DATA, `/stocks/${encodeURIComponent(symbol)}/bars?timeframe=1Min&feed=iex&sort=asc&limit=10000&start=${encodeURIComponent(start)}${token ? "&page_token=" + encodeURIComponent(token) : ""}`);
    out = out.concat((d.bars || []).map(map));
    if (!d.next_page_token) break;
    token = d.next_page_token;
  }
  res.status(200).json({ symbol, feed: "iex", days, bars: out });
});

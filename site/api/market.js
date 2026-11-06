// Real market data with no API keys, for any ticker.
// ?symbol=SPY            -> latest price and name
// ?symbol=SPY&days=1..7  -> 1-minute bars for the last N days (Yahoo keeps about a week of 1-minute data)
const { cleanSymbol, chart, bars, nameOf } = require("./_yahoo");
module.exports = async (req, res) => {
  const q = req.query || {};
  const symbol = cleanSymbol(q.symbol || "SPY");
  if (!symbol) return res.status(400).json({ error: "that does not look like a ticker" });
  const days = Math.min(Math.max(Number(q.days) || 0, 0), 7);
  try {
    if (!days) {
      res.setHeader("cache-control", "public, s-maxage=1, stale-while-revalidate=2");
      const r = await chart(`${symbol}?range=1d&interval=1m`, 1500);
      const m = r.meta || {};
      if (!(m.regularMarketPrice > 0)) return res.status(404).json({ error: "no price for " + symbol });
      return res.status(200).json({ symbol, name: nameOf(m), source: "yahoo", price: m.regularMarketPrice, time: m.regularMarketTime || null, currency: m.currency || "USD" });
    }
    res.setHeader("cache-control", "public, s-maxage=30, stale-while-revalidate=60");
    const end = Math.floor(Date.now() / 1000), start = end - days * 86400;
    const r = await chart(`${symbol}?interval=1m&period1=${start}&period2=${end}`, 30000);
    return res.status(200).json({ symbol, name: nameOf(r.meta), source: "yahoo", days, bars: bars(r) });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.status === 404 ? "unknown ticker: " + symbol : e.message || "Yahoo unreachable" });
  }
};

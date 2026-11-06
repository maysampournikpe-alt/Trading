// Real market data with no API keys: Yahoo Finance's public chart endpoint (unofficial, may be delayed or rate-limited).
// ?symbol=SPY            -> latest price
// ?symbol=SPY&days=1..7  -> 1-minute bars for the last N days (Yahoo keeps about a week of 1-minute data)
const { SYMBOLS } = require("./_alpaca");
const cache = new Map();
async function yahoo(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + path, { headers: { "user-agent": "Mozilla/5.0 (compatible; trader-skills-site/1.0)", accept: "application/json" } });
  if (!r.ok) throw Object.assign(new Error("Yahoo returned " + r.status), { status: 502 });
  const d = await r.json();
  const res = d && d.chart && d.chart.result && d.chart.result[0];
  if (!res) throw Object.assign(new Error((d && d.chart && d.chart.error && d.chart.error.description) || "no data from Yahoo"), { status: 502 });
  cache.set(path, { at: Date.now(), data: res });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return res;
}
module.exports = async (req, res) => {
  const q = req.query || {};
  const symbol = String(q.symbol || "SPY");
  if (!SYMBOLS.includes(symbol)) return res.status(400).json({ error: "symbol not on the allowlist" });
  const days = Math.min(Math.max(Number(q.days) || 0, 0), 7);
  try {
    if (!days) {
      res.setHeader("cache-control", "public, s-maxage=1, stale-while-revalidate=2");
      const r = await yahoo(`${symbol}?range=1d&interval=1m`, 1500);
      const m = r.meta || {};
      if (!(m.regularMarketPrice > 0)) return res.status(502).json({ error: "Yahoo has no price for " + symbol });
      return res.status(200).json({ symbol, source: "yahoo", price: m.regularMarketPrice, time: m.regularMarketTime || null, currency: m.currency || "USD" });
    }
    res.setHeader("cache-control", "public, s-maxage=30, stale-while-revalidate=60");
    const end = Math.floor(Date.now() / 1000), start = end - days * 86400;
    const r = await yahoo(`${symbol}?interval=1m&period1=${start}&period2=${end}`, 30000);
    const t = r.timestamp || [], k = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
    const bars = [];
    for (let i = 0; i < t.length; i++) {
      const o = k.open && k.open[i], h = k.high && k.high[i], l = k.low && k.low[i], c = k.close && k.close[i];
      if (o == null || h == null || l == null || c == null) continue; // Yahoo leaves gaps as null
      bars.push({ time: t[i], open: o, high: h, low: l, close: c, volume: (k.volume && k.volume[i]) || 0 });
    }
    return res.status(200).json({ symbol, source: "yahoo", days, bars });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || "Yahoo unreachable" });
  }
};

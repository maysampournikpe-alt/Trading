// Shared Yahoo Finance chart fetcher (public, unofficial endpoint; may be delayed or rate-limited), with a small cache.
const cache = new Map();
const TICKER = /^[A-Z][A-Z0-9.\-]{0,9}$/; // any normal US ticker, e.g. AAPL, BRK-B, SPY
function cleanSymbol(s) { const t = String(s || "").trim().toUpperCase(); return TICKER.test(t) ? t : null; }
async function chart(path, ttlMs) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlMs) return hit.data;
  const r = await fetch("https://query1.finance.yahoo.com/v8/finance/chart/" + path, { headers: { "user-agent": "Mozilla/5.0 (compatible; trader-skills-site/1.0)", accept: "application/json" } });
  if (r.status === 404) throw Object.assign(new Error("unknown ticker"), { status: 404 });
  if (!r.ok) throw Object.assign(new Error("Yahoo returned " + r.status), { status: 502 });
  const d = await r.json();
  const res = d && d.chart && d.chart.result && d.chart.result[0];
  if (!res) throw Object.assign(new Error((d && d.chart && d.chart.error && d.chart.error.description) || "no data from Yahoo"), { status: 404 });
  cache.set(path, { at: Date.now(), data: res });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return res;
}
function bars(res) {
  const t = res.timestamp || [], k = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {}, out = [];
  for (let i = 0; i < t.length; i++) {
    const o = k.open && k.open[i], h = k.high && k.high[i], l = k.low && k.low[i], c = k.close && k.close[i];
    if (o == null || h == null || l == null || c == null) continue; // Yahoo leaves gaps as null
    out.push({ time: t[i], open: o, high: h, low: l, close: c, volume: (k.volume && k.volume[i]) || 0 });
  }
  return out;
}
const nameOf = m => (m && (m.shortName || m.longName)) || null;
module.exports = { cleanSymbol, chart, bars, nameOf };

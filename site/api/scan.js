// "Stocks in play" scanner: ranks a list of liquid stocks by relative volume (today's volume so far versus the
// average volume by the same time of day over the previous sessions), the filter used in opening-range research
// (Zarattini et al.). Public, cached 60 seconds.
const { chart, bars, nameOf } = require("./_yahoo");
const UNIVERSE = ["SPY","QQQ","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","TSLA","AMD","AVGO","NFLX","JPM","BAC","XOM","UNH","COST","PLTR","COIN","MU","INTC","SMCI","UBER","DIS","BA","WMT","KO","CRM","SHOP"];
const etFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" });
function et(sec) { const p = etFmt.formatToParts(new Date(sec * 1000)), g = k => p.find(x => x.type === k).value; return { day: g("year") + g("month") + g("day"), min: (+g("hour") % 24) * 60 + +g("minute") }; }
let last = null;
async function scanOne(symbol) {
  const end = Math.floor(Date.now() / 1000), start = end - 7 * 86400;
  const r = await chart(`${symbol}?interval=1m&period1=${start}&period2=${end}`, 60000);
  const B = bars(r).filter(b => { const e = et(b.time); return e.min >= 570 && e.min < 960; }); // regular session only
  if (B.length < 50) return null;
  const days = {};
  for (const b of B) { const e = et(b.time); (days[e.day] = days[e.day] || []).push({ ...b, min: e.min }); }
  const keys = Object.keys(days).sort(), today = days[keys[keys.length - 1]], prev = keys.slice(0, -1).map(k => days[k]);
  if (!prev.length) return null;
  const now = today[today.length - 1].min;
  const volTo = d => d.filter(b => b.min <= now).reduce((s, b) => s + b.volume, 0);
  const avgPrev = prev.map(volTo).reduce((a, b) => a + b, 0) / prev.length;
  const todayVol = volTo(today), price = today[today.length - 1].close, prevClose = prev[prev.length - 1].slice(-1)[0].close;
  const hi = Math.max(...today.map(b => b.high)), lo = Math.min(...today.map(b => b.low));
  return { symbol, name: nameOf(r.meta), price, change: price / prevClose - 1, range: (hi - lo) / price, relVol: avgPrev > 0 ? todayVol / avgPrev : null, volume: todayVol, asOfMin: now, day: keys[keys.length - 1] };
}
async function runScan() {
  if (last && Date.now() - last.at < 60000) return last.data;
  const settled = await Promise.allSettled(UNIVERSE.map(scanOne));
  const rows = settled.map(s => s.status === "fulfilled" ? s.value : null).filter(Boolean).filter(r => r.relVol != null);
  if (!rows.length) throw Object.assign(new Error("could not load any stocks from Yahoo"), { status: 502 });
  rows.sort((a, b) => b.relVol - a.relVol || Math.abs(b.change) - Math.abs(a.change));
  const now = et(Math.floor(Date.now() / 1000)), day = rows[0].day;
  const data = { at: new Date().toISOString(), session: day === now.day && now.min >= 570 && now.min < 960 ? "live" : "last", scanned: UNIVERSE.length, rows };
  last = { at: Date.now(), data };
  return data;
}
module.exports = async (req, res) => {
  res.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=120");
  try { res.status(200).json(await runScan()); }
  catch (e) { res.status(e.status || 502).json({ error: e.message }); }
};
module.exports.runScan = runScan;

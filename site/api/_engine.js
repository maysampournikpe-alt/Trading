// Server-side copy of the chart bot's rules (site/chart.html: smcStep, filterBlocks, backtest).
// runDay replays one trading day of 1-minute bars and returns every trade the bot makes, so the
// server bot can wake up every few minutes, replay today, and record any new trades.
// Keep in step with chart.html when rules change.
const RISK = { riskPerTrade: 0.01, maxPos: 0.25, dailyLoss: 0.02 };
const FOMC = new Set(["20260128", "20260318", "20260429", "20260617", "20260729", "20260916", "20261028", "20261209"]);
const etFmt = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
function etOf(ms) { const p = etFmt.formatToParts(new Date(ms)), g = k => p.find(x => x.type === k).value; return { day: g("year") + g("month") + g("day"), min: (+g("hour") % 24) * 60 + +g("minute"), wd: g("weekday") }; }
const etBar = b => b._et || (b._et = etOf(b.time * 1000));
const subFor = (min, sel) => sel !== "auto" ? sel : min < 660 ? "orb" : min < 930 ? "smc" : "mom";
function atr(B, n, len = 14) { let s = 0, k = 0; for (let i = Math.max(1, n - len + 1); i <= n; i++) { const b = B[i], pc = B[i - 1].close; s += Math.max(b.high - b.low, Math.abs(b.high - pc), Math.abs(b.low - pc)); k++; } return k ? s / k : 0; }
function vwapAt(B, n) {
  const d = etBar(B[n]).day; let pv = 0, v = 0, sp = 0, k = 0;
  for (let i = n; i >= 0; i--) { const b = B[i], e = etBar(b); if (e.day !== d || e.min < 570) break; const tp = (b.high + b.low + b.close) / 3; pv += tp * (b.volume || 0); v += b.volume || 0; sp += tp; k++; }
  return v > 0 ? pv / v : k ? sp / k : null;
}
function smcStep(st, B, n) {
  const b = B[n], L = 20; if (n < L + 5) return { st, ev: null };
  if (st && n - st.at > 20) return { st: null, ev: st.phase === "fvg" ? "expired" : null };
  if (!st || st.phase === "sweep" && b.low < st.low) {
    let prevLow = Infinity; for (let i = n - L; i < n; i++) prevLow = Math.min(prevLow, B[i].low);
    if (b.low < prevLow && b.close > prevLow) { let hi = -Infinity; for (let i = n - 10; i <= n; i++) hi = Math.max(hi, B[i].high); return { st: { phase: "sweep", at: n, low: b.low, high: hi }, ev: "sweep" }; }
  }
  if (st && st.phase === "sweep") {
    const body = Math.abs(b.close - b.open), range = b.high - b.low;
    if (b.close > st.high && range > 0 && body / range > 0.5) st = { ...st, bos: n };
    if (st.bos != null && n - st.bos <= 2) { const a = B[n - 2];
      if (a.high < b.low) { const entry = (a.high + b.low) / 2, stop = Math.min(st.low - Math.max(0.01, st.low * 0.0002), entry - atr(B, n));
        return { st: { ...st, phase: "fvg", at: n, lo: a.high, hi: b.low, entry, stop }, ev: "fvg" }; } }
  }
  return { st, ev: null };
}
// opts: { strat: "auto"|"smc"|"orb"|"mom"|"mr", startEq, costPct, fomc, vwap, final }
function runDay(B, opts) {
  const strat = opts.strat || "auto", c = (opts.costPct == null ? 0.02 : opts.costPct) / 100;
  const blocks = (n, price) => { if (!B[n]) return null; const e = etBar(B[n]);
    if (opts.fomc !== false && FOMC.has(e.day) && e.min >= 810 && e.min < 900) return "fed";
    if (opts.vwap) { const v = vwapAt(B, n); if (v && price < v) return "vwap"; } return null; };
  let eq = opts.startEq, pos = null, st = null, cool = -1, s2 = strat; const day = {}, events = [];
  const close = (price, i, why) => { const px = price * (1 - c), gain = pos.shares * (px - pos.entry); eq += gain;
    events.push({ t: B[i].time, side: "sell", price: px, shares: pos.shares, gain, why, strat: pos.strat }); pos = null; st = null; cool = i + 1; };
  const open = (price, i, stop, target, frac, why) => { const px = price * (1 + c);
    const usd = frac ? eq * frac : Math.min(eq * RISK.riskPerTrade / Math.max(px - stop, px * 1e-4) * px, eq * (RISK.maxPos - 0.005));
    if (usd < 10) return; pos = { entry: px, stop, target, shares: usd / px, i, strat: s2, t: B[i].time };
    events.push({ t: B[i].time, side: "buy", price: px, shares: pos.shares, usd, why, strat: s2, stop, target }); };
  for (let i = 1; i < B.length; i++) {
    const b = B[i], et = etBar(b);
    if (et.min >= 570 && et.min < 575) { day.orH = Math.max(day.orH || 0, b.high); day.orL = Math.min(day.orL || 1e9, b.low); }
    if (et.min >= 570 && day.open930 == null) day.open930 = b.open;
    if (et.min === 599 && day.open930) day.ret30 = b.close / day.open930 - 1;
    if (pos) {
      if (pos.stop && b.low <= pos.stop) close(Math.min(b.open, pos.stop), i, "stop");
      else if (pos.target && b.high >= pos.target) close(Math.max(b.open, pos.target), i, "target");
      else if ((pos.strat === "orb" && et.min >= 955) || (pos.strat === "mom" && et.min >= 959) || (pos.strat === "smc" && i - pos.i >= 45)) close(b.close, i, "time");
      else if (pos.strat === "mr") { let m = 0, sd = 0; for (let k = i - 29; k <= i; k++) m += B[k].close; m /= 30; for (let k = i - 29; k <= i; k++) sd += (B[k].close - m) ** 2; sd = Math.sqrt(sd / 30);
        const ret = b.close / pos.entry - 1; if (ret >= 0.0008 || ret <= -0.0008 || i - pos.i >= 5 || (sd > 0 && (b.close - m) / sd >= 0.3)) close(b.close, i, "exit"); }
    }
    if (!pos && i >= cool) {
      s2 = subFor(et.min, strat);
      const ok = price => eq > opts.startEq * (1 - RISK.dailyLoss) && !blocks(i - 1, price);
      if (s2 === "smc") {
        if (st && st.phase === "fvg" && b.low <= st.entry && b.open > st.stop) { const px = Math.min(b.open, st.entry); if (ok(px)) open(px, i, st.stop, px + 2 * (px - st.stop), 0, "fair value gap retest"); st = null; }
        if (!pos) st = smcStep(st, B, i).st;
      } else if (s2 === "orb") {
        if (day.orH && !day.orbDone && et.min >= 575 && et.min < 660 && b.high > day.orH) { const px = Math.max(b.open, day.orH), range = day.orH - day.orL, stop = range / day.orH > 0.004 ? (day.orH + day.orL) / 2 : day.orL;
          day.orbDone = true; if (ok(px)) open(px, i, stop, px + 2 * (px - stop), 0, "opening range breakout"); }
      } else if (s2 === "mom") {
        if (day.ret30 != null && !day.momDone && et.min >= 930 && et.min < 955) { day.momDone = true; if (day.ret30 > 0 && ok(b.open)) open(b.open, i, b.open * 0.995, 0, 0.20, "first half hour was up"); }
      } else if (s2 === "mr" && i >= 30) {
        let m = 0, sd = 0; for (let k = i - 29; k <= i; k++) m += B[k].close; m /= 30; for (let k = i - 29; k <= i; k++) sd += (B[k].close - m) ** 2; sd = Math.sqrt(sd / 30);
        if (sd > 0 && (b.close - m) / sd <= -1.8 && ok(b.close)) open(b.close, i, 0, 0, 0.20, "dip");
      }
    }
  }
  if (pos && opts.final && B.length) close(B[B.length - 1].close, B.length - 1, "market close");
  const last = B.length ? B[B.length - 1].close : 0;
  return { events, eq, pos: pos ? { entry: pos.entry, shares: pos.shares, stop: pos.stop, target: pos.target, strat: pos.strat, t: pos.t } : null,
    markEq: eq + (pos ? pos.shares * (last * (1 - c) - pos.entry) : 0), last };
}
module.exports = { runDay, etOf, subFor, RISK };

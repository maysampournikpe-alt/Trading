// The server bot: one fake-money account per signed-in user, stored at bot/<user>.json.
const { readJson, writeJson, listPaths } = require("./_store");
const { runDay, etOf } = require("./_engine");
const { chart, bars: toBars, cleanSymbol } = require("./_yahoo");
const START = 10000;
const fresh = user => ({ user, enabled: false, settings: { strat: "auto", autoPick: true, symbol: "SPY", fomc: true, vwap: false },
  start: START, equity: START, day: null, history: [], log: [], lastTick: null, created: new Date().toISOString() });
const load = async user => (await readJson(`bot/${user}.json`)) || fresh(user);
const save = bot => writeJson(`bot/${bot.user}.json`, bot);
function note(bot, m) { bot.log.unshift({ t: new Date().toISOString(), m }); bot.log = bot.log.slice(0, 100); }
const isSession = et => !["Sat", "Sun"].includes(et.wd) && et.min >= 570 && et.min < 960;
const fmt = x => "$" + Number(x).toFixed(2);

async function todayBars(symbol, day, upToSec) {
  const r = await chart(`${symbol}?range=1d&interval=1m`, 45000);
  return toBars(r).filter(b => { const e = etOf(b.time * 1000); return e.day === day && e.min >= 570 && e.min < 960 && b.time + 60 <= upToSec; }); // closed candles only
}
// Advance one bot to "now". pickTop() returns the scanner's top symbol (only called when needed).
async function step(bot, pickTop, nowMs = Date.now()) {
  const et = etOf(nowMs), nowSec = Math.floor(nowMs / 1000);
  if (bot.day && bot.day.d !== et.day) { // close out a previous day
    const d = bot.day; bot.equity = d.markEq ?? d.startEq;
    bot.history.unshift({ d: d.d, symbol: d.symbol, startEq: d.startEq, endEq: bot.equity, trades: d.events.filter(e => e.side === "sell").length });
    bot.history = bot.history.slice(0, 90); bot.day = null;
  }
  if (!bot.enabled || !isSession(et)) { bot.lastTick = new Date(nowMs).toISOString(); return bot; }
  if (!bot.day) {
    let symbol = cleanSymbol(bot.settings.symbol) || "SPY";
    if (bot.settings.autoPick) {
      if (et.min < 575) return bot; // let the first 5 minutes trade before picking by volume
      try { symbol = (await pickTop()) || symbol; } catch (e) { note(bot, "scanner unavailable, trading " + symbol); }
    }
    bot.day = { d: et.day, symbol, startEq: bot.equity, events: [], pos: null, markEq: bot.equity, rules: { ...bot.settings } }; // settings are fixed for the day
    note(bot, `trading ${symbol} today (${bot.settings.autoPick ? "most active stock" : "your pick"}), strategy ${bot.settings.strat}`);
  }
  const d = bot.day, B = await todayBars(d.symbol, d.d, nowSec);
  if (B.length < 2) { bot.lastTick = new Date(nowMs).toISOString(); return bot; }
  const rules = d.rules || bot.settings;
  const r = runDay(B, { strat: rules.strat, startEq: d.startEq, fomc: rules.fomc, vwap: rules.vwap, final: et.min >= 959 });
  const seen = new Set(d.events.map(e => e.side + e.t));
  const at = t => { const m = etOf(t * 1000).min; return ` at ${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} ET`; };
  for (const e of r.events) if (!seen.has(e.side + e.t)) note(bot, (e.side === "buy"
    ? `BUY ${e.shares.toFixed(4)} ${d.symbol} @ ${fmt(e.price)} (${fmt(e.usd)}): ${e.why}`
    : `SELL ${e.shares.toFixed(4)} ${d.symbol} @ ${fmt(e.price)} (${e.gain >= 0 ? "+" : "-"}${fmt(Math.abs(e.gain))}): ${e.why}`) + at(e.t));
  d.events = r.events; d.pos = r.pos; d.markEq = r.markEq; d.last = r.last; d.bars = B.length;
  bot.lastTick = new Date(nowMs).toISOString();
  return bot;
}
async function enabledUsers() {
  const paths = await listPaths("bot/");
  return paths.map(p => p.slice(4, -5)).filter(u => /^[a-z0-9_]{3,20}$/.test(u));
}
module.exports = { fresh, load, save, step, enabledUsers, note, isSession, START };

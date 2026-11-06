// The signed-in user's server bot: GET its state, POST to start, stop, change settings or reset.
const { userFrom, handler } = require("./_session");
const { load, save, step, fresh, note } = require("./_bot");
const { cleanSymbol } = require("./_yahoo");
const { runScan } = require("./scan");
const STRATS = ["auto", "smc", "orb", "mom", "mr"];
module.exports = handler(async (req, res) => {
  const user = userFrom(req);
  if (!user) return res.status(401).json({ error: "sign in to run the bot on the server" });
  let bot = await load(user);
  if (req.method === "POST") {
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (b.settings && typeof b.settings === "object") {
      const s = b.settings, cur = bot.settings;
      if (STRATS.includes(s.strat)) cur.strat = s.strat;
      if (typeof s.autoPick === "boolean") cur.autoPick = s.autoPick;
      if (s.symbol != null) { const t = cleanSymbol(s.symbol); if (!t) return res.status(400).json({ error: "that does not look like a ticker" }); cur.symbol = t; }
      if (typeof s.fomc === "boolean") cur.fomc = s.fomc;
      if (typeof s.vwap === "boolean") cur.vwap = s.vwap;
    }
    if (b.settings && bot.day && bot.enabled) note(bot, "new settings apply from the next trading day");
    if (b.action === "start") { bot.enabled = true; note(bot, "bot started on the server"); }
    else if (b.action === "stop") { bot.enabled = false; note(bot, "bot stopped"); }
    else if (b.action === "reset") { bot = fresh(user); note(bot, "account reset to $10,000"); }
    else if (b.action && b.action !== "settings") return res.status(400).json({ error: "unknown action" });
    if (bot.enabled) { try { bot = await step(bot, async () => (await runScan()).rows[0].symbol); } catch (e) { /* market data hiccup: the next tick catches up */ } }
    await save(bot);
  }
  res.status(200).json(bot);
});

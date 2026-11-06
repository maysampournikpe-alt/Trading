// Wakes every enabled server bot. Called by the scheduler every 5 minutes during market hours,
// and by open chart pages. Safe to call often: it does real work at most once a minute.
const { readJson, writeJson } = require("./_store");
const { load, save, step, enabledUsers, isSession } = require("./_bot");
const { etOf } = require("./_engine");
const { runScan } = require("./scan");
module.exports = async (req, res) => {
  res.setHeader("cache-control", "no-store");
  try {
    const et = etOf(Date.now());
    if (!isSession(et) && !(et.min >= 960 && et.min < 990)) return res.status(200).json({ skipped: "market closed" });
    const meta = (await readJson("bot-meta/tick.json")) || {};
    if (meta.at && Date.now() - Date.parse(meta.at) < 55000) return res.status(200).json({ skipped: "ran less than a minute ago" });
    await writeJson("bot-meta/tick.json", { at: new Date(Date.now()).toISOString() });
    let top = null; const pickTop = async () => top || (top = (await runScan()).rows[0].symbol);
    const users = await enabledUsers(), done = [], failed = [];
    for (const u of users) {
      try { let bot = await load(u); if (!bot.enabled && !bot.day) continue; bot = await step(bot, pickTop); await save(bot); done.push(u); }
      catch (e) { failed.push(u); }
    }
    res.status(200).json({ ok: true, bots: done.length, failed: failed.length });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.status ? e.message : "tick failed" });
  }
};

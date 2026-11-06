const { readJson, writeJson } = require("./_store");
const { userFrom, handler } = require("./_session");
module.exports = handler(async (req, res) => {
  const u = userFrom(req);
  if (!u) return res.status(401).json({ error: "not signed in" });
  const path = `state/${u}.json`;
  if (req.method === "GET") return res.status(200).json({ state: await readJson(path) });
  if (req.method !== "PUT") return res.status(405).json({ error: "GET or PUT only" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  if (b.state === null) { await writeJson(path, null); return res.status(200).json({ ok: true }); } // Reset
  const s = b.state;
  const ok = s && typeof s === "object" && Array.isArray(s.lots) && Array.isArray(s.log) && s.prices && typeof s.prices === "object" && typeof s.cash === "number";
  if (!ok || JSON.stringify(s).length > 300000) return res.status(400).json({ error: "bad state" });
  await writeJson(path, s);
  res.status(200).json({ ok: true });
});

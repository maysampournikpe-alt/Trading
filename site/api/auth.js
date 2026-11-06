const crypto = require("crypto");
const { readJson, writeJson } = require("./_store");
const { secret, NAME, makeToken, cookie, userFrom, hashPw, limited, handler } = require("./_session");
const ip = req => String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
const bad = (res, code, error) => res.status(code).json({ error });

module.exports = handler(async (req, res) => {
  if (req.method === "GET") { // who am I
    const u = userFrom(req);
    return u ? res.status(200).json({ username: u }) : bad(res, 401, "not signed in");
  }
  if (req.method !== "POST") return bad(res, 405, "POST only");
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const { action } = b, username = String(b.username || "").trim().toLowerCase(), password = String(b.password || "");

  if (action === "logout") { res.setHeader("set-cookie", cookie("")); return res.status(200).json({ ok: true }); }
  if (action !== "signup" && action !== "login") return bad(res, 400, "unknown action");
  secret(); // fail early (503) if the server is not set up, before anything is written
  if (!NAME.test(username)) return bad(res, 400, "username: 3-20 letters, numbers or underscores");
  if (password.length < 8 || password.length > 128) return bad(res, 400, "password must be 8 to 128 characters");

  if (action === "signup") {
    if (limited("su|" + ip(req), 5, 3600e3)) return bad(res, 429, "too many sign-ups from this address, try later");
    const salt = crypto.randomBytes(16);
    const hash = await hashPw(password, salt);
    try {
      await writeJson(`users/${username}.json`, { username, salt: salt.toString("base64"), hash: hash.toString("base64"), created: new Date().toISOString() }, { overwrite: false });
    } catch (e) {
      if (e.code === "EXISTS") return bad(res, 409, "that username is taken");
      throw e;
    }
    res.setHeader("set-cookie", cookie(makeToken(username)));
    return res.status(200).json({ username });
  }

  // login: same work and same message whether or not the user exists
  if (limited("li|" + ip(req) + "|" + username, 10, 600e3)) return bad(res, 429, "too many attempts, wait a few minutes");
  const rec = await readJson(`users/${username}.json`);
  const salt = rec ? Buffer.from(rec.salt, "base64") : Buffer.alloc(16);
  const hash = await hashPw(password, salt);
  const want = rec ? Buffer.from(rec.hash, "base64") : Buffer.alloc(64);
  if (!rec || want.length !== hash.length || !crypto.timingSafeEqual(want, hash)) return bad(res, 401, "wrong username or password");
  res.setHeader("set-cookie", cookie(makeToken(username)));
  return res.status(200).json({ username });
});

// Shared helpers for the live trader. Paper by default; real money only when ALPACA_MODE=live is set on the server.
const crypto = require("crypto");
const LIVE = process.env.ALPACA_MODE === "live";
const TRADING = LIVE ? "https://api.alpaca.markets/v2" : "https://paper-api.alpaca.markets/v2";
const DAILY_LOSS_PCT = Number(process.env.DAILY_LOSS_PCT || 3); // buys stop when equity is this % below yesterday's close
const DATA = "https://data.alpaca.markets/v2";
const SYMBOLS = ["AAPL", "AXP", "GOOGL", "KO", "BAC"];
const MAX_ORDER_USD = Number(process.env.MAX_ORDER_USD || 500);

function authorized(req) {
  const pass = process.env.TRADER_PASSCODE || "";
  const got = String(req.headers["x-trader-passcode"] || "");
  if (!pass || pass.length < 8) return false; // refuse to run without a real passcode
  const a = Buffer.from(got), b = Buffer.from(pass);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function keys() {
  const id = process.env.ALPACA_API_KEY_ID, secret = process.env.ALPACA_API_SECRET_KEY;
  return id && secret ? { "APCA-API-KEY-ID": id, "APCA-API-SECRET-KEY": secret } : null;
}
async function alpaca(base, path, opts = {}) {
  const h = keys();
  if (!h) throw Object.assign(new Error("Alpaca keys are not set on the server"), { status: 503 });
  const r = await fetch(base + path, { ...opts, headers: { ...h, "content-type": "application/json" } });
  const text = await r.text();
  let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  if (!r.ok) throw Object.assign(new Error(body.message || "Alpaca error " + r.status), { status: r.status });
  return body;
}
// wraps a handler: passcode check, JSON errors
function guard(fn) {
  return async (req, res) => {
    res.setHeader("cache-control", "no-store");
    if (!authorized(req)) return res.status(401).json({ error: "wrong or missing passcode (or TRADER_PASSCODE not set on the server)" });
    try { await fn(req, res); }
    catch (e) { res.status(e.status && e.status < 600 ? e.status : 500).json({ error: e.message }); }
  };
}
module.exports = { LIVE, DAILY_LOSS_PCT, TRADING, DATA, SYMBOLS, MAX_ORDER_USD, alpaca, guard };

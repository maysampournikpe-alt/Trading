const { DAILY_LOSS_PCT, TRADING, DATA, MAX_ORDER_USD, MIN_PRICE, cleanSymbol, checkAsset, alpaca, guard } = require("./_alpaca");
const recent = []; // best-effort rate limit per warm instance
module.exports = guard(async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const symbol = cleanSymbol(b.symbol), side = b.side;
  if (!symbol) return res.status(400).json({ error: "that does not look like a ticker" });
  if (side !== "buy" && side !== "sell") return res.status(400).json({ error: "side must be buy or sell" });
  const now = Date.now();
  while (recent.length && now - recent[0] > 60000) recent.shift();
  if (recent.length >= 40) return res.status(429).json({ error: "too many orders this minute" });

  const [account, positions] = await Promise.all([alpaca(TRADING, "/account"), alpaca(TRADING, "/positions")]);
  const held = Number((positions.find(p => p.symbol === symbol) || {}).qty || 0);
  let order = { symbol, side, type: "market", time_in_force: "day" };
  if (side === "buy") {
    const usd = Number(b.notional);
    if (!(usd >= 1 && usd <= MAX_ORDER_USD)) return res.status(400).json({ error: `notional must be between $1 and $${MAX_ORDER_USD}` });
    const equity = Number(account.equity);
    const day = (equity - Number(account.last_equity)) / Number(account.last_equity) * 100;
    if (day <= -DAILY_LOSS_PCT) return res.status(400).json({ error: `daily loss limit hit (${day.toFixed(2)}%): buying is halted for today` });
    if (Number(account.cash) - usd < equity * 0.10) return res.status(400).json({ error: "risk: would dip into the 10% cash buffer" });
    const cur = Number((positions.find(p => p.symbol === symbol) || {}).market_value || 0);
    if ((cur + usd) / equity > 0.25) return res.status(400).json({ error: "risk: position would exceed 25% of equity" });
    const bad = await checkAsset(symbol, true);
    if (bad) return res.status(400).json({ error: bad });
    const t = await alpaca(DATA, `/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=iex`);
    const px = Number(t && t.trade && t.trade.p);
    if (!(px >= MIN_PRICE)) return res.status(400).json({ error: `${symbol} is under $${MIN_PRICE} a share (penny stocks are not allowed)` });
    order.notional = usd.toFixed(2);
  } else {
    const qty = Number(b.qty);
    if (!(qty > 0) || qty > held + 1e-9) return res.status(400).json({ error: "no short sales: qty must not exceed the position" });
    order.qty = String(qty);
  }
  recent.push(now);
  const placed = await alpaca(TRADING, "/orders", { method: "POST", body: JSON.stringify(order) });
  res.status(200).json({ id: placed.id, status: placed.status, symbol, side });
});

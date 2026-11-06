// StockTwits bull/bear sentiment for one symbol, from its public stream (last ~30 messages).
// Public read-only data, so no passcode; cached for 60 seconds per symbol.
const { cleanSymbol } = require("./_yahoo");
const cache = new Map();
module.exports = async (req, res) => {
  const symbol = cleanSymbol((req.query && req.query.symbol) || "SPY");
  if (!symbol) return res.status(400).json({ error: "that does not look like a ticker" });
  res.setHeader("cache-control", "public, s-maxage=60, stale-while-revalidate=60");
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < 60000) return res.status(200).json(hit.data);
  try {
    const r = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, { headers: { "user-agent": "trader-skills-site/1.0", accept: "application/json" } });
    if (!r.ok) return res.status(502).json({ error: "StockTwits returned " + r.status });
    const d = await r.json();
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    let bull = 0, bear = 0;
    for (const m of msgs) {
      const s = m.entities && m.entities.sentiment && m.entities.sentiment.basic;
      if (s === "Bullish") bull++; else if (s === "Bearish") bear++;
    }
    const times = msgs.map(m => Date.parse(m.created_at)).filter(Boolean);
    const spanH = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 36e5 : 0;
    const data = { symbol, source: "stocktwits", messages: msgs.length, bull, bear, tagged: bull + bear,
      bullShare: bull + bear ? bull / (bull + bear) : 0.5, perHour: spanH > 0 ? +(msgs.length / spanH).toFixed(1) : null, at: new Date().toISOString() };
    cache.set(symbol, { at: Date.now(), data });
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: "StockTwits unreachable" });
  }
};

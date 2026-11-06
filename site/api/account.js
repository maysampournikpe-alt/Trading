const { TRADING, alpaca, guard } = require("./_alpaca");
module.exports = guard(async (req, res) => {
  const [account, positions, clock] = await Promise.all([
    alpaca(TRADING, "/account"), alpaca(TRADING, "/positions"), alpaca(TRADING, "/clock")]);
  res.status(200).json({
    paper: true,
    equity: Number(account.equity), last_equity: Number(account.last_equity), cash: Number(account.cash),
    buying_power: Number(account.buying_power), market_open: clock.is_open, next_open: clock.next_open, next_close: clock.next_close,
    positions: positions.map(p => ({ symbol: p.symbol, qty: Number(p.qty), avg: Number(p.avg_entry_price),
      price: Number(p.current_price), value: Number(p.market_value), pl: Number(p.unrealized_pl) })),
  });
});

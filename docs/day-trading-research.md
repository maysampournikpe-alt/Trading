# Day trading research notes

What the tick chart bot (`site/chart.html`) is built on, and how strong the evidence is. Gathered November 2026.

## The two videos

Both are by TJR Trades (Tyler Riches): *How To Start Day Trading In 2026 [Full Tutorial]* (`yiuFUp0kFz8`) and *How To Start Day Trading As A Beginner In 2026 (9 hours)* (`aobHuNcI1QM`). YouTube and the summary site were blocked from the build environment, so the content below comes from published descriptions of his model, not from watching the videos.

His model, as described by third parties:
- **Liquidity sweep:** price wicks beyond a pool of stops (previous day or session highs and lows, equal highs or lows) and closes back inside.
- **Break of structure:** a strong (displacement) candle then breaks a recent swing level in the other direction; one script requires a body over 50% of the candle's range.
- **Fair value gap entry:** price retraces into the three-candle gap that move left, entering at the gap's edge or 50% level; stop beyond the sweep extreme.
- **Sessions:** focus on the New York open; also covers futures (ES, NQ) and forex.

**Evidence:** no independent or peer-reviewed test of sweep / fair value gap models was found. The only numbers are vendor backtests with unpublished methods (for example a claimed 53% win rate and 1.68 profit factor on forex).

## Day trading in general

- Most retail day traders lose money after costs. Taiwan: fewer than 1% earn reliable abnormal returns net of fees (Barber et al.). Brazil: about 1% of persistent day traders earned more than minimum wage (Chague et al.). US broker data: about twice as many lose as win (Jordan & Diltz, *FAJ* 2003); a direct-access broker sample was closer to half profitable but highly concentrated (Garvey & Murphy).
- 7,846 intraday technical rules on 5-minute SPY data were not profitable after correcting for data snooping (Marshall, Cahan & Cahan, 2008).

## Strategies used by the bot

| Strategy | Evidence |
|---|---|
| Liquidity sweep + FVG (TJR-style) | Vendor claims only. |
| Opening range breakout (5 min) | Mixed. A 2018-2026 SPY replication drops to a deflated Sharpe of 0.42 after correcting for the 57 versions tried (Subhani, SSRN). Practitioner papers (Zarattini et al., Concretum) are more positive but not peer-reviewed. |
| Intraday momentum (last half hour) | Best-supported: the first half-hour return predicts the last half-hour return on SPY (Gao, Han, Li & Zhou, *Journal of Financial Economics*, 2018), R-squared about 1.6%, replicated in 12 of 16 markets. Gross only; profits may not survive costs except on extreme days. |
| Tick mean reversion (scalp) | No evidence; spread and costs dominate at this horizon. |

**Candlestick patterns:** hammer and engulfing show modest, short-lived edges in some datasets (about 55-60% hit rates at best); peer-reviewed work does not support strong standalone predictive power.

## Social media sentiment

- StockTwits: the first half-hour change in sentiment predicts the last half-hour SPY return (Renault, *Journal of Banking & Finance*, 2017, 60 million messages). Message polarity does not predict next-day returns on average, but does after sudden spikes in message volume (Divernois & Filipovic, 2023). Effects fade quickly.
- The bot therefore uses StockTwits only as a **filter** (skip buys when tagged messages are under 45% bullish), never as a reason to buy. StockTwits' public API status in 2026 is unconfirmed; if it fails, the filter is ignored.

## Round two: what else the research says

- **Most intraday signals do not survive costs.** A 2026 falsification study tested 14 signal families on 947 days of 5-minute Nasdaq futures data with walk-forward testing, a t-statistic of at least 2, at least 30 trades and real costs: none passed. The gross edge was about 0.07-1.50 points a trade, less than the roughly 2-point cost (Mesfin, arXiv 2605.04004). The backtest's verdicts use the same bar: at least 30 trades, profitable after costs, t of at least 2, and better than buy-and-hold.
- **Backtests flatter whatever was tried most.** Testing many variants and keeping the best inflates its Sharpe ratio even when every variant is noise; the Deflated Sharpe Ratio corrects for the number of trials (Bailey & Lopez de Prado). The backtest therefore warns that the best of four strategies on one period looks better than it is.
- **Overnight vs intraday.** Momentum profits accrue overnight and other strategies' profits intraday, a "tug of war" between clienteles (Lou, Polk & Skouras, *JFE* 2019). Day-only strategies give up the overnight part of returns, one reason buy-and-hold is a hard benchmark.
- **The pre-FOMC drift has faded.** Stocks used to rise before Fed announcements (Lucca & Moench, *Journal of Finance* 2015), but the drift largely disappeared after 2015 (Kurov, Wolfe & Gilbert 2021) or moved earlier (BIS working paper). The bot does not trade it; instead it can sit out the 13:30-15:00 ET window on 2026 decision days (Jan 28, Mar 18, Apr 29, Jun 17, Jul 29, Sep 16, Oct 28, Dec 9), when volatility jumps. Check the Fed's calendar for 2027.
- **Volatility targeting** reduces risk reliably, but its extra return is contested out of sample and after costs (Moreira & Muir 2017; Cederburg et al. 2020; Barroso & Detzel 2021; DeMiguel et al. 2024). The bot's stop-based sizing already shrinks positions when stops are wide.
- **Trend following** (time-series momentum) works over months across asset classes (Moskowitz, Ooi & Pedersen 2012; Hurst, Ooi & Pedersen, a century of data), not minutes; replications attribute much of it to volatility scaling.
- **ATR stops and VWAP filters** are standard practice but untested in research; the bot keeps its sweep stop at least one ATR away so normal noise is less likely to stop it out, and offers "only buy above VWAP" as an opt-in filter.
- **Time of day:** volume and volatility are U-shaped (high at the open and close, low midday), which is why the session strategies act at the open and the close.

## Risk rules applied

- 1% of equity at risk per trade, position sized from the stop distance; 2% daily loss stops new buys (common educator framework, not a regulation).
- The skills' trader-risk limits: 10% cash buffer, 25% max position, $10 minimum order, daily order cap, no short selling.
- The SEC approved FINRA's removal of the $25,000 pattern day trader rule in April 2026, replaced by intraday margin requirements, phased in through 2027. Check your broker.

## Sources

- [Jordan & Diltz, The Profitability of Day Traders (FAJ)](https://www.tandfonline.com/doi/abs/10.2469/faj.v59.n6.2578)
- [Garvey & Murphy, The Profitability of Active Stock Traders](https://www.nuff.ox.ac.uk/Users/MurphyA/Active%20Traders.pdf)
- [Gao, Han, Li & Zhou, Market Intraday Momentum (JFE 2018)](https://econpapers.repec.org/RePEc:eee:jfinec:v:129:y:2018:i:2:p:394-414)
- [Intraday momentum summary (Alpha Architect)](https://alphaarchitect.com/2014/08/attention-prop-traders-the-first-half-hour-of-trading-predicts-the-last-half-hour/)
- [Opening-range breakouts: a search-aware replication (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=7589980)
- [Opening range breakout for stocks in play (QuantConnect)](https://www.quantconnect.com/research/18444/opening-range-breakout-for-stocks-in-play/)
- [Renault, Intraday online investor sentiment and return patterns (JBF 2017)](https://www.sciencedirect.com/science/article/abs/pii/S0378426617301589)
- [Divernois & Filipovic, StockTwits classified sentiment and stock returns](https://www.semanticscholar.org/paper/StockTwits-classified-sentiment-and-stock-returns-Divernois-Filipovi%C4%87/1d06831beb020e91ebc7a4139ae93eafbfb52347)
- [Candlestick patterns in intraday crypto markets (ScienceDirect)](https://sciencedirect.com/science/article/pii/S1059056026002716)
- [Candlestick patterns on a real estate ETF (ResearchGate)](https://www.researchgate.net/publication/395052476_Evaluating_the_Predictive_Power_of_Candlestick_Patterns_in_the_Real_Estate_Financial_Market)
- [TJR-style model described (TradingView community script)](https://it.tradingview.com/script/xXrbltSH-TJR-v4-Strategy/)
- [TJR New York open strategy write-up](https://www.forex.in.rs/tjr-trader-strategy)
- [Liquidity sweep vendor backtest (Backtrex)](https://backtrex.com/en/blog/liquidity-sweep-strategy-backtest-results)
- [SEC approves removal of the $25K day trading minimum (Finance Magnates)](https://www.financemagnates.com/forex/sec-approves-plan-to-remove-25k-day-trading-limit-how-will-the-risk-taking-approach-impact-traders/)
- [Risk management for beginner traders (Curved Trading)](https://curvedtrading.com/articles/en/how/risk-management-beginners/)
- [Mesfin, Structural Limits of OHLCV-Based Intraday Signals (arXiv 2605.04004)](https://arxiv.org/abs/2605.04004)
- [Bailey & Lopez de Prado, The Deflated Sharpe Ratio (SSRN)](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551)
- [Lou, Polk & Skouras, A Tug of War (JFE 2019)](https://econpapers.repec.org/RePEc:eee:jfinec:v:134:y:2019:i:1:p:192-213)
- [Lucca & Moench, The Pre-FOMC Announcement Drift (JF 2015)](https://www.emanuelmoench.com/documents/Lucca_Moench(JF2015).pdf)
- [The disappearing pre-FOMC announcement drift (ScienceDirect)](https://www.sciencedirect.com/science/article/abs/pii/S1544612320315956)
- [BIS working paper on the pre-announcement drift](https://www.bis.org/publ/work1079.pdf)
- [DeMiguel et al., A Multifactor Perspective on Volatility-Managed Portfolios (JF 2024)](https://onlinelibrary.wiley.com/doi/full/10.1111/jofi.13395)
- [Moskowitz, Ooi & Pedersen, Time Series Momentum](https://elmwealth.com/wp-content/uploads/2017/06/timeseriesmomentum.pdf)
- [Hurst, Ooi & Pedersen, A Century of Evidence on Trend-Following (SSRN)](https://papers.ssrn.com/sol3/Delivery.cfm/SSRN_ID2993026_code277060.pdf?abstractid=2993026)
- [FOMC meeting schedule 2026 (fedratecalc)](https://fedratecalc.com/fomc-meeting-schedule/)
- [Intraday time-of-day effects (LuxAlgo)](https://www.luxalgo.com/library/concept/intraday-time-of-day-effects.md)
- [How To Start Day Trading In 2026 (YouTube)](https://www.youtube.com/watch?v=yiuFUp0kFz8) and [the 9-hour course (YouTube)](https://www.youtube.com/watch?v=aobHuNcI1QM)

import express, { Request, Response } from 'express';
import { MasterTraderAgent, PriceLevel } from '../agents/MasterTraderAgent.js';

const app = express();
app.use(express.json());

const trader = new MasterTraderAgent();

/**
 * Webhook endpoint that receives TradingView alerts
 */
app.post('/webhook/tradingview', async (req: Request, res: Response) => {
  try {
    const alert = req.body;

    console.log(`\n📨 TradingView Alert Received:`);
    console.log(`Symbol: ${alert.symbol}`);
    console.log(`Signal: ${alert.signal}`);
    console.log(`Price: ${alert.price}`);

    // Parse TradingView alert message
    const priceData: PriceLevel = {
      symbol: alert.symbol || 'UNKNOWN',
      price: parseFloat(alert.price) || 0,
      timestamp: new Date().toISOString(),
      signal: alert.signal === 'BUY' ? 'IQ_BUY' : alert.signal === 'SELL' ? 'IQ_SELL' : 'NONE',
      support: parseFloat(alert.support) || 0,
      resistance: parseFloat(alert.resistance) || 0,
      session: alert.session || 'Unknown',
    };

    // Analyze with MasterTrader
    const analysis = await trader.analyzePriceAction(priceData);

    // Check if we should trade
    if (analysis.includes('BUY') && priceData.signal === 'IQ_BUY') {
      const trade = await trader.executeTrade(
        priceData.symbol,
        'IQ_BUY',
        priceData.price,
        priceData.support || 0,
        priceData.resistance || 0
      );

      // Send notification back
      res.json({
        status: 'TRADE_OPENED',
        trade: trade,
        analysis: analysis,
      });
    } else if (analysis.includes('SELL') && priceData.signal === 'IQ_SELL') {
      const trade = await trader.executeTrade(
        priceData.symbol,
        'IQ_SELL',
        priceData.price,
        priceData.support || 0,
        priceData.resistance || 0
      );

      res.json({
        status: 'TRADE_OPENED',
        trade: trade,
        analysis: analysis,
      });
    } else {
      res.json({
        status: 'SIGNAL_ANALYZED',
        decision: 'WAIT',
        analysis: analysis,
      });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * Manual trade close endpoint
 */
app.post('/webhook/close-trade', (req: Request, res: Response) => {
  const { tradeId, exitPrice, reason } = req.body;

  const closedTrade = trader.closeTrade(tradeId, parseFloat(exitPrice), reason);

  if (closedTrade) {
    res.json({
      status: 'TRADE_CLOSED',
      trade: closedTrade,
      summary: trader.getPerformanceSummary(),
    });
  } else {
    res.status(404).json({ error: 'Trade not found' });
  }
});

/**
 * Get trader state endpoint
 */
app.get('/api/trader-state', (req: Request, res: Response) => {
  res.json({
    state: trader.getState(),
    summary: trader.getPerformanceSummary(),
  });
});

/**
 * Get performance metrics
 */
app.get('/api/performance', (req: Request, res: Response) => {
  const state = trader.getState();
  const totalTrades = state.closedTrades.length;
  const winners = state.closedTrades.filter((t: any) => (t.profitLoss || 0) > 0).length;

  res.json({
    totalTrades,
    winners,
    winRate: (state.winRate * 100).toFixed(1),
    totalPnL: state.totalPnL.toFixed(2),
    openTrades: state.openTrades.length,
    consecutiveWins: state.consecutiveWins,
  });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`✅ TradingView Webhook Server running on port ${PORT}`);
  console.log(`📍 Webhook URL: https://your-railway-url.railway.app/webhook/tradingview`);
});

export default app;

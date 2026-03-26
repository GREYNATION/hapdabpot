import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Zap, Target, AlertCircle } from 'lucide-react';

interface Trade {
  id: string;
  symbol: string;
  entryPrice: number;
  exitPrice?: number;
  signal: 'IQ_BUY' | 'IQ_SELL';
  size: number;
  status: 'OPEN' | 'CLOSED';
  profitLoss?: number;
  profitLossPercent?: number;
  entryTime: string;
}

interface TraderState {
  openTrades: Trade[];
  closedTrades: Trade[];
  totalPnL: number;
  winRate: number;
  consecutiveWins: number;
}

export default function TradingDashboard() {
  const [traderState, setTraderState] = useState<TraderState>({
    openTrades: [],
    closedTrades: [],
    totalPnL: 0,
    winRate: 0,
    consecutiveWins: 0,
  });

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [stats, setStats] = useState({
    totalTrades: 0,
    winners: 0,
    losers: 0,
    avgWin: 0,
    avgLoss: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [connected, setConnected] = useState<boolean | null>(null);

  // Fetch trader state periodically
  useEffect(() => {
    const fetchTraderState = async () => {
      try {
        // Proxy via Vite's dev proxy to hit the backend /api/trader-state
        const response = await fetch('/api/trader-state');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setTraderState(data.state);
        setConnected(true);
        setLastUpdated(new Date().toLocaleTimeString());

        // Calculate stats
        const totalTrades = data.state.closedTrades.length;
        const winners = data.state.closedTrades.filter(
          (t: Trade) => (t.profitLoss || 0) > 0
        ).length;
        const losers = totalTrades - winners;
        const avgWin =
          winners > 0
            ? data.state.closedTrades
                .filter((t: Trade) => (t.profitLoss || 0) > 0)
                .reduce((sum: number, t: Trade) => sum + (t.profitLoss || 0), 0) /
              winners
            : 0;
        const avgLoss =
          losers > 0
            ? Math.abs(
                data.state.closedTrades
                  .filter((t: Trade) => (t.profitLoss || 0) <= 0)
                  .reduce((sum: number, t: Trade) => sum + (t.profitLoss || 0), 0) /
                losers
              )
            : 0;
        setStats({ totalTrades, winners, losers, avgWin, avgLoss });
      } catch (error) {
        console.error('Failed to fetch trader state:', error);
        setConnected(false);
      }
    };

    fetchTraderState();
    const interval = setInterval(fetchTraderState, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-black text-white p-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap size={32} className="text-yellow-500" />
            <h1 className="text-4xl font-bold">Master Trader</h1>
          </div>
          <p className="text-gray-400 text-sm">Real-time IQ Buy/Sell • Tradovate Execution</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${
              connected === null ? 'bg-yellow-400' : connected ? 'bg-green-400' : 'bg-red-400'
            }`}
          />
          <span className={connected === null ? 'text-yellow-300' : connected ? 'text-green-300' : 'text-red-300'}>
            {connected === null ? 'Connecting…' : connected ? `Live  •  ${lastUpdated}` : 'Disconnected — check API'}
          </span>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {/* Total P&L */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Total P&L</span>
            {traderState.totalPnL >= 0 ? (
              <TrendingUp size={16} className="text-green-400" />
            ) : (
              <TrendingDown size={16} className="text-red-400" />
            )}
          </div>
          <p className={`text-3xl font-bold ${traderState.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${traderState.totalPnL.toFixed(2)}
          </p>
        </div>

        {/* Win Rate */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Win Rate</span>
            <Target size={16} className="text-blue-400" />
          </div>
          <p className="text-3xl font-bold text-blue-400">
            {(traderState.winRate * 100).toFixed(1)}%
          </p>
        </div>

        {/* Open Trades */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Open Trades</span>
            <Zap size={16} className="text-yellow-400" />
          </div>
          <p className="text-3xl font-bold text-yellow-400">
            {traderState.openTrades.length}
          </p>
        </div>

        {/* Consecutive Wins */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Consec. Wins</span>
            <TrendingUp size={16} className="text-green-400" />
          </div>
          <p className="text-3xl font-bold text-green-400">
            {traderState.consecutiveWins}
          </p>
        </div>

        {/* Total Trades */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-xs">Total Trades</span>
            <AlertCircle size={16} className="text-purple-400" />
          </div>
          <p className="text-3xl font-bold text-purple-400">{stats.totalTrades}</p>
        </div>
      </div>

      {/* Open Trades */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          📊 Open Positions
          {traderState.openTrades.length > 0 && (
            <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
              {traderState.openTrades.length} active
            </span>
          )}
        </h2>
        {traderState.openTrades.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-8 text-center">
            <p className="text-gray-500">No open positions — waiting for signal</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {traderState.openTrades.map(trade => (
              <div
                key={trade.id}
                onClick={() => setSelectedTrade(selectedTrade?.id === trade.id ? null : trade)}
                className={`bg-slate-800/50 border rounded-xl p-4 cursor-pointer transition-all ${
                  selectedTrade?.id === trade.id
                    ? 'border-yellow-500 bg-slate-700/60'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{trade.symbol}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        trade.signal === 'IQ_BUY'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.signal === 'IQ_BUY' ? '⬆ BUY' : '⬇ SELL'}
                      </span>
                      <span className="text-gray-400 text-xs">Entry: ${trade.entryPrice}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{trade.size}x</p>
                    <p className="text-gray-400 text-xs">{new Date(trade.entryTime).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">📈 Trade History</h2>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <span className="text-gray-400 text-xs block mb-1">Total Trades</span>
            <p className="font-bold text-lg">{stats.totalTrades}</p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <span className="text-gray-400 text-xs block mb-1">Winners / Losers</span>
            <p className="font-bold text-lg">
              <span className="text-green-400">{stats.winners}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-red-400">{stats.losers}</span>
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <span className="text-gray-400 text-xs block mb-1">Avg Win / Loss</span>
            <p className="font-bold text-lg">
              <span className="text-green-400">${stats.avgWin.toFixed(0)}</span>
              <span className="text-gray-500"> / </span>
              <span className="text-red-400">-${stats.avgLoss.toFixed(0)}</span>
            </p>
          </div>
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3">
            <span className="text-gray-400 text-xs block mb-1">Win/Loss Ratio</span>
            <p className="font-bold text-lg text-blue-400">
              {(stats.avgWin / (stats.avgLoss || 1)).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Recent Trades List */}
        {traderState.closedTrades.length === 0 ? (
          <div className="bg-slate-800/30 border border-slate-700 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm">No closed trades yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {traderState.closedTrades.slice(0, 10).map(trade => (
              <div
                key={trade.id}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 flex items-center justify-between hover:border-slate-500 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    (trade.profitLoss || 0) > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="font-semibold">{trade.symbol}</p>
                    <p className="text-xs text-gray-400">
                      {trade.signal === 'IQ_BUY' ? '⬆' : '⬇'} {trade.signal} @ ${trade.entryPrice}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`font-bold ${(trade.profitLoss || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(trade.profitLoss || 0) > 0 ? '+' : ''}${trade.profitLoss?.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">{trade.profitLossPercent?.toFixed(2)}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-600 text-xs">
        <p>Master Trader • Tradovate • TradingView Webhook</p>
      </div>
    </div>
  );
}

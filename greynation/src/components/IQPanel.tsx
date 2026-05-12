import { Brain, TrendingUp, Zap, Activity } from 'lucide-react';

interface Props {
  iq: number;
  tokens: number;
  autoLoop: boolean;
  onToggleLoop: () => void;
}

export default function IQPanel({ iq, tokens, autoLoop, onToggleLoop }: Props) {
  const tier = iq > 400 ? 'HYPER-TIER' : iq > 300 ? 'SUPERINTELLIGENCE' : iq > 200 ? 'ADVANCED' : 'STANDARD';
  const tierColor = iq > 400 ? 'text-yellow-400' : iq > 300 ? 'text-cyan-400' : iq > 200 ? 'text-blue-400' : 'text-gray-400';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* IQ Metric */}
      <div className="bg-black/40 border border-cyan-500/15 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-3 right-3 p-1.5 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
          <Brain className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="text-[9px] font-mono text-cyan-500/60 uppercase tracking-wider mb-1">NEURAL IQ</div>
        <div className="text-3xl font-orbitron font-black text-white animate-iqPulse">{iq.toFixed(1)}</div>
        <div className={`text-[9px] font-mono ${tierColor} mt-1 flex items-center gap-1`}>
          <TrendingUp className="w-3 h-3" /> {tier}
        </div>
      </div>

      {/* Tokens */}
      <div className="bg-black/40 border border-yellow-500/15 rounded-xl p-4 relative overflow-hidden">
        <div className="absolute top-3 right-3 p-1.5 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <Zap className="w-4 h-4 text-yellow-400" />
        </div>
        <div className="text-[9px] font-mono text-yellow-500/60 uppercase tracking-wider mb-1">SERVER TOKENS</div>
        <div className="text-2xl font-orbitron font-black text-yellow-400">{(tokens / 1000).toFixed(1)}k</div>
        <div className="text-[9px] font-mono text-yellow-500/50 mt-1">STK AVAILABLE</div>
      </div>

      {/* Auto Loop */}
      <div className="col-span-2 bg-black/40 border border-purple-500/15 rounded-xl p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${autoLoop ? 'text-emerald-400 animate-pulse' : 'text-gray-500'}`} />
          <div>
            <div className="text-[9px] font-mono text-purple-400/80 uppercase tracking-wider">AUTO-EVOLUTION LOOP</div>
            <div className="text-[9px] font-mono text-gray-500">{autoLoop ? 'IQ growing in background...' : 'Manual mode active'}</div>
          </div>
        </div>
        <button onClick={onToggleLoop}
          className={`text-[9px] font-mono px-3 py-1.5 rounded-lg border font-bold transition-all ${
            autoLoop
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-gray-500/10 border-gray-500/30 text-gray-400 hover:bg-gray-500/20'
          }`}>
          {autoLoop ? 'DISABLE' : 'ENABLE'}
        </button>
      </div>
    </div>
  );
}

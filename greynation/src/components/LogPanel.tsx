import { Terminal } from 'lucide-react';
import { LogEntry } from '../data/greynation';

const typeColors: Record<string, string> = {
  success: 'text-emerald-400',
  warning: 'text-yellow-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

const systemColors: Record<string, string> = {
  GREYNATION: 'bg-cyan-500/20 text-cyan-300',
  HAPDABOT: 'bg-blue-500/20 text-blue-300',
  'GRAVITY-CLAW': 'bg-purple-500/20 text-purple-300',
  TRADER: 'bg-yellow-500/20 text-yellow-300',
  CORTEX: 'bg-cyan-500/20 text-cyan-300',
  CRITIC: 'bg-red-500/20 text-red-300',
  MEMORY: 'bg-indigo-500/20 text-indigo-300',
  VISION: 'bg-teal-500/20 text-teal-300',
  HANDS: 'bg-green-500/20 text-green-300',
};

export default function LogPanel({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="bg-black/40 border border-cyan-500/10 rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: 280 }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-cyan-500/10">
        <Terminal className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-bold">LIVE REASONING STREAM</span>
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
      </div>
      <div className="overflow-y-auto flex-1 p-3 space-y-2">
        {logs.map(log => (
          <div key={log.id} className="text-[10px] font-mono bg-black/30 rounded-lg p-2 border border-white/5 animate-fadeIn">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${systemColors[log.system] || 'bg-gray-500/20 text-gray-300'}`}>
                {log.system}
              </span>
              <span className={`${typeColors[log.type]} text-[8px]`}>●</span>
              <span className="text-gray-600 ml-auto">{log.timestamp}</span>
            </div>
            <p className="text-gray-300 leading-relaxed">{log.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

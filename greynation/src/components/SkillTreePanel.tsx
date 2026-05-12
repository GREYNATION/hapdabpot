import { Lock, Unlock, Zap } from 'lucide-react';
import { SKILL_TREE } from '../data/greynation';
import { useState } from 'react';

interface Props {
  tokens: number;
  onUnlock: (cost: number, iqGain: number) => void;
}

export default function SkillTreePanel({ tokens, onUnlock }: Props) {
  const [unlocked, setUnlocked] = useState<Set<string>>(
    new Set(SKILL_TREE.filter(s => s.unlocked).map(s => s.id))
  );

  const unlock = (id: string, cost: number) => {
    if (tokens < cost) return;
    setUnlocked(prev => new Set([...prev, id]));
    onUnlock(cost, Math.floor(cost / 500));
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 p-4">
      {SKILL_TREE.map(skill => {
        const isUnlocked = unlocked.has(skill.id);
        return (
          <div key={skill.id}
            className={`rounded-xl border p-4 flex flex-col gap-2 transition-all ${
              isUnlocked
                ? 'bg-cyan-500/5 border-cyan-500/25 shadow-[0_0_15px_rgba(0,255,238,.05)]'
                : 'bg-black/20 border-gray-700/30 opacity-60'
            }`}>
            <div className="text-2xl">{skill.icon}</div>
            <div className="font-mono text-xs font-bold text-white">{skill.name}</div>
            <div className="font-mono text-[9px] text-gray-400 leading-relaxed">{skill.desc}</div>
            {isUnlocked ? (
              <div className="mt-auto flex items-center gap-1 text-emerald-400 text-[9px] font-mono font-bold">
                <Unlock className="w-3 h-3" /> ACTIVE
              </div>
            ) : (
              <button onClick={() => unlock(skill.id, skill.cost)}
                disabled={tokens < skill.cost}
                className="mt-auto flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-1.5 rounded border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                <Zap className="w-3 h-3" /> {skill.cost.toLocaleString()} STK
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

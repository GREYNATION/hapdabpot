import { useState, useRef, useEffect } from 'react';
import { Send, Eye, Mic } from 'lucide-react';
import { Message } from '../hooks/useGreynation';
import { QUICK_PROMPTS, AGENT_TRIGGERS, SYSTEM_PROMPT } from '../data/greynation';

interface Props {
  messages: Message[];
  isThinking: boolean;
  onSend: (text: string) => void;
  onVision: () => void;
}

export default function ChatPanel({ messages, isThinking, onSend, onVision }: Props) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || isThinking) return;
    setInput('');
    onSend(text);
  };

  return (
    <div className="flex flex-col h-full bg-black/40 border border-cyan-500/10 rounded-xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-cyan-500/40 text-xs font-mono mt-8">
            GREYNATION NEURAL OS READY<br/>
            <span className="text-cyan-500/20">Awaiting your orders, sir.</span>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex flex-col gap-1 animate-fadeIn ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`text-[9px] font-mono opacity-50 px-1 ${msg.role === 'user' ? 'text-purple-400' : 'text-cyan-400'}`}>
              {msg.role === 'user' ? 'HAP' : 'HAPDA_BOT'}
            </div>
            <div className={`max-w-[88%] px-3 py-2.5 text-sm font-mono leading-relaxed ${
              msg.role === 'user'
                ? 'bg-purple-500/10 border border-purple-500/20 text-purple-100 rounded-2xl rounded-br-sm'
                : 'bg-cyan-500/5 border border-cyan-500/15 border-l-2 border-l-cyan-500/50 text-cyan-50 rounded-2xl rounded-bl-sm'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isThinking && (
          <div className="flex items-start gap-2 animate-fadeIn">
            <div className="text-[9px] font-mono text-cyan-400 opacity-50 px-1 mt-1">HAPDA_BOT</div>
            <div className="bg-cyan-500/5 border border-cyan-500/15 border-l-2 border-l-cyan-500/50 px-3 py-2.5 rounded-2xl rounded-bl-sm">
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                    style={{ animation: `pulse 0.8s ease-in-out ${i * 0.15}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div className="px-3 py-2 border-t border-cyan-500/10 flex gap-1.5 flex-wrap">
        {QUICK_PROMPTS.slice(0, 4).map((p, i) => (
          <button key={i} onClick={() => setInput(p.query)}
            className="text-[9px] font-mono px-2 py-1 rounded bg-cyan-500/5 border border-cyan-500/15 text-cyan-400 hover:bg-cyan-500/10 transition-colors whitespace-nowrap">
            {p.label}
          </button>
        ))}
      </div>

      {/* Vision button */}
      <button onClick={onVision}
        className="mx-3 mb-2 py-2 text-[9px] font-mono tracking-widest text-cyan-400 border border-cyan-500/20 rounded bg-cyan-500/5 hover:bg-cyan-500/10 transition-colors flex items-center justify-center gap-2">
        <Eye className="w-3 h-3" />
        WHAT DO YOU SEE?
      </button>

      {/* Input */}
      <div className="flex gap-2 p-3 border-t border-cyan-500/10">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="Speak to HAPDA_BOT..."
          disabled={isThinking}
          className="flex-1 bg-black/60 border border-cyan-500/20 text-cyan-50 text-sm font-mono px-3 py-2.5 rounded-lg outline-none focus:border-cyan-500/50 placeholder-cyan-500/20 disabled:opacity-40"
        />
        <button onClick={handleSend} disabled={isThinking || !input.trim()}
          className="px-4 py-2.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/20 disabled:opacity-30 transition-colors">
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

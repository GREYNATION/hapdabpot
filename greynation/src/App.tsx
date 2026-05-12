import { useState, useCallback } from 'react';
import { Brain, Terminal, GitBranch, Network, Zap, Settings, ChevronRight, Building } from 'lucide-react';
import HapdaAvatar from './components/HapdaAvatar';
import ChatPanel from './components/ChatPanel';
import IQPanel from './components/IQPanel';
import LogPanel from './components/LogPanel';
import SkillTreePanel from './components/SkillTreePanel';
import KnowledgeGraphPanel from './components/KnowledgeGraphPanel';
import WholesalePanel from './components/WholesalePanel';
import { useGreynation, Message } from './hooks/useGreynation';
import { AGENT_TRIGGERS, SYSTEM_PROMPT } from './data/greynation';

// Hapdabot b64 image - will be empty string, user adds their image
const HAPDA_B64 = '';

type Tab = 'chat' | 'skills' | 'graph' | 'logs' | 'settings' | 'wholesale';

const TABS = [
  { id: 'chat' as Tab, label: 'COMMAND', icon: Terminal },
  { id: 'wholesale' as Tab, label: 'WHOLESALE', icon: Building },
  { id: 'skills' as Tab, label: 'SKILLS', icon: Brain },
  { id: 'graph' as Tab, label: 'NEURAL MAP', icon: Network },
  { id: 'logs' as Tab, label: 'STREAM', icon: GitBranch },
  { id: 'settings' as Tab, label: 'CONFIG', icon: Settings },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('chat');
  const [status, setStatus] = useState('ONLINE');
  const {
    iq, setIq, logs, addLog, messages, setMessages,
    isThinking, setIsThinking, isTalking, tokens, setTokens,
    autoLoop, setAutoLoop, speak, handsAction, visionAnalyze,
    fireHapdabot, chat
  } = useGreynation();

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setStatus('PROCESSING');
    addLog('HAPDA_BOT', 'info', `Processing: "${text.slice(0, 60)}..."`);

    // Fire hands triggers immediately
    const cm = text.match(/click at (\d+)[, ]+(\d+)/i);
    if (cm) { handsAction('click', { x: parseInt(cm[1]), y: parseInt(cm[2]) }); }
    const tm = text.match(/type[: ]+(.+)/i);
    if (tm) { handsAction('type', { text: tm[1] }); }
    const sm = text.match(/scroll (up|down)/i);
    if (sm) { handsAction('scroll', { direction: sm[1], amount: 3 }); }
    const km = text.match(/press (enter|escape|tab|space|backspace)/i);
    if (km) { handsAction('key', { key: km[1] }); }

    // Vision trigger
    let visionContext = '';
    if (text.toLowerCase().includes('what do you see') || text.toLowerCase().includes('look at') || text.toLowerCase().includes('screen')) {
      addLog('VISION', 'info', 'Capturing screen for analysis...');
      visionContext = await visionAnalyze('Describe what you see on screen precisely in Jarvis style.');
    }

    // Railway triggers
    if (AGENT_TRIGGERS.some(t => text.toLowerCase().includes(t))) {
      fireHapdabot(text);
    }

    try {
      const fullPrompt = visionContext
        ? `${SYSTEM_PROMPT}\n\nCURRENT SCREEN: ${visionContext}`
        : SYSTEM_PROMPT;

      const reply = await chat(text, fullPrompt, messages);
      const botMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', content: reply, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
      setIq(prev => +(prev + 0.1 + Math.random() * 0.2).toFixed(2));
      setTokens(prev => prev + 100 + Math.floor(Math.random() * 50));
      addLog('HAPDA_BOT', 'success', `Response delivered. IQ +0.1. Neural pathways strengthened.`);
      speak(reply.slice(0, 300));
      setStatus('ONLINE');
    } catch (e) {
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'bot', content: 'Systems experiencing interference, sir. Stand by.', timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
      addLog('HAPDA_BOT', 'error', 'OpenJarvis connection failed. Check server status.');
      setStatus('INTERFERENCE');
      setTimeout(() => setStatus('ONLINE'), 3000);
    }
    setIsThinking(false);
  }, [messages, addLog, handsAction, visionAnalyze, fireHapdabot, chat, speak, setMessages, setIsThinking, setIq, setTokens]);

  const handleVision = useCallback(async () => {
    setStatus('SCANNING');
    addLog('VISION', 'info', 'Initiating visual scan...');
    const analysis = await visionAnalyze('You are the eyes of HAPDA_BOT. Describe exactly what is on screen in Jarvis style — brief, precise, actionable.');
    const botMsg: Message = { id: Date.now().toString(), role: 'bot', content: analysis, timestamp: new Date() };
    setMessages(prev => [...prev, botMsg]);
    speak(analysis.slice(0, 300));
    setStatus('ONLINE');
  }, [visionAnalyze, speak, addLog, setMessages]);

  const handleUnlock = useCallback((cost: number, iqGain: number) => {
    setTokens(prev => prev - cost);
    setIq(prev => +(prev + iqGain).toFixed(1));
    addLog('SKILL TREE', 'success', `New capability unlocked. IQ +${iqGain}. Token cost: ${cost} STK.`);
  }, [setTokens, setIq, addLog]);

  const statusColor = status === 'ONLINE' ? 'bg-emerald-500' : status === 'PROCESSING' ? 'bg-blue-500' : status === 'SCANNING' ? 'bg-cyan-500' : 'bg-yellow-500';

  return (
    <div className="min-h-screen bg-cyber-dark overflow-hidden">
      <div className="scanline" />
      <div className="corner tl" /><div className="corner tr" />
      <div className="corner bl" /><div className="corner br" />

      {/* Header */}
      <div className="border-b border-cyan-500/10 bg-black/60 backdrop-blur-sm px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="font-orbitron font-black text-sm tracking-[.4em] text-cyan-100">HAPDA_BOT</div>
          <div className="text-[9px] font-mono text-cyan-500/40 tracking-widest">JARVIS MODE // GREYNATION NEURAL OS</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-[9px] font-mono text-cyan-500/50">IQ <span className="text-cyan-300 font-bold animate-iqPulse">{iq.toFixed(1)}</span></div>
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse`} />
            <span className="text-[9px] font-mono text-cyan-500/70">{status}</span>
          </div>
        </div>
      </div>

      <div className="flex h-[calc(100vh-53px)]">
        {/* Left — Avatar + IQ + Logs */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 p-4 border-r border-cyan-500/10 overflow-y-auto">
          {/* Avatar */}
          <div className="flex justify-center py-2">
            <HapdaAvatar isTalking={isTalking} isThinking={isThinking} b64Image={HAPDA_B64} />
          </div>

          {/* Status badge */}
          <div className="flex justify-center">
            <div className="text-[9px] font-mono text-cyan-400 border border-cyan-500/20 bg-black/60 px-4 py-1.5 rounded-full flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${statusColor} animate-pulse`} />
              {status}
            </div>
          </div>

          {/* IQ Panel */}
          <IQPanel iq={iq} tokens={tokens} autoLoop={autoLoop} onToggleLoop={() => setAutoLoop(!autoLoop)} />

          {/* Log Panel */}
          <LogPanel logs={logs} />
        </div>

        {/* Right — Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-cyan-500/10 bg-black/40">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-3 text-[9px] font-mono font-bold tracking-widest transition-all border-b-2 ${
                  tab === t.id
                    ? 'border-cyan-500 text-cyan-300 bg-cyan-500/5'
                    : 'border-transparent text-gray-500 hover:text-cyan-500/70 hover:bg-cyan-500/5'
                }`}>
                <t.icon className="w-3 h-3" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {tab === 'chat' && (
              <div className="h-full p-4">
                <ChatPanel messages={messages} isThinking={isThinking} onSend={handleSend} onVision={handleVision} />
              </div>
            )}
            {tab === 'wholesale' && (
              <div className="h-full">
                <WholesalePanel />
              </div>
            )}
            {tab === 'skills' && (
              <div className="h-full overflow-y-auto">
                <div className="p-4 border-b border-cyan-500/10">
                  <div className="text-xs font-mono text-cyan-400 font-bold">GREYNATION SKILL TREE</div>
                  <div className="text-[9px] font-mono text-gray-500 mt-1">Unlock new capabilities with Server Tokens. Each unlock grows HAPDA_BOT IQ permanently.</div>
                </div>
                <SkillTreePanel tokens={tokens} onUnlock={handleUnlock} />
              </div>
            )}
            {tab === 'graph' && (
              <div className="h-full overflow-y-auto p-4">
                <div className="mb-4">
                  <div className="text-xs font-mono text-cyan-400 font-bold">GREYNATION NEURAL TOPOLOGY</div>
                  <div className="text-[9px] font-mono text-gray-500 mt-1">Live map of all GREYNATION agents, services and data flows.</div>
                </div>
                <KnowledgeGraphPanel />
              </div>
            )}
            {tab === 'logs' && (
              <div className="h-full overflow-y-auto p-4">
                <div className="mb-4">
                  <div className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    LIVE REASONING STREAM
                  </div>
                  <div className="text-[9px] font-mono text-gray-500 mt-1">Real-time GREYNATION neural activity feed.</div>
                </div>
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="text-[10px] font-mono bg-black/40 rounded-lg p-3 border border-white/5 animate-fadeIn">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${
                          log.system === 'HAPDA_BOT' ? 'bg-cyan-500/20 text-cyan-300' :
                          log.system === 'VISION' ? 'bg-teal-500/20 text-teal-300' :
                          log.system === 'HANDS' ? 'bg-green-500/20 text-green-300' :
                          log.system === 'TRADER' ? 'bg-yellow-500/20 text-yellow-300' :
                          'bg-gray-500/20 text-gray-300'
                        }`}>{log.system}</span>
                        <span className={`text-[8px] ${log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-blue-400'}`}>●</span>
                        <span className="text-gray-600 ml-auto text-[8px]">{log.timestamp}</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed">{log.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tab === 'settings' && (
              <div className="h-full overflow-y-auto p-4 space-y-4">
                <div className="text-xs font-mono text-cyan-400 font-bold">GREYNATION CONFIGURATION</div>
                {[
                  { label: 'OpenJarvis Server', value: 'http://localhost:8010', status: 'CONNECTED' },
                  { label: 'Vision Agent', value: 'http://localhost:3200', status: 'CONNECTED' },
                  { label: 'Hands Agent', value: 'http://localhost:3300', status: 'CONNECTED' },
                  { label: 'Railway Hapdabot', value: 'https://www.stuyza.com', status: 'CONNECTED' },
                  { label: 'AI Model', value: 'claude-opus-4-5', status: 'ACTIVE' },
                ].map((item, i) => (
                  <div key={i} className="bg-black/40 border border-cyan-500/10 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[9px] font-mono text-gray-400 uppercase tracking-wider">{item.label}</div>
                      <div className="text-xs font-mono text-cyan-300 mt-1">{item.value}</div>
                    </div>
                    <div className="text-[8px] font-mono text-emerald-400 border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 rounded">
                      {item.status}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

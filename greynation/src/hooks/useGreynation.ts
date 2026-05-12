import { useState, useEffect, useCallback } from 'react';
import { LogEntry, INITIAL_LOGS } from '../data/greynation';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  content: string;
  timestamp: Date;
}

export function useGreynation() {
  const [iq, setIq] = useState(345);
  const [logs, setLogs] = useState<LogEntry[]>(INITIAL_LOGS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [tokens, setTokens] = useState(185000);
  const [autoLoop, setAutoLoop] = useState(true);

  // Real-time Neural Bridge (WebSocket)
  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.hostname}:3142`);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'heartbeat') return;
        
        const entry: LogEntry = {
          id: Date.now().toString() + Math.random(),
          system: data.agent || 'SYSTEM',
          type: data.type === 'error' ? 'error' : data.type === 'warning' ? 'warning' : 'success',
          message: data.message,
          timestamp: new Date().toLocaleTimeString()
        };
        setLogs(prev => [entry, ...prev].slice(0, 30));
      } catch (e) {
        console.error("WebSocket message error", e);
      }
    };

    ws.onopen = () => {
      addLog('SYSTEM', 'success', 'Neural bridge synced. Live telemetry active.');
    };

    ws.onerror = () => {
      addLog('SYSTEM', 'error', 'Neural bridge interference. Retrying...');
    };

    return () => ws.close();
  }, [addLog]);

  const addLog = useCallback((system: string, type: LogEntry['type'], message: string) => {
    const entry: LogEntry = {
      id: Date.now().toString() + Math.random(),
      system,
      type,
      message,
      timestamp: new Date().toLocaleTimeString()
    };
    setLogs(prev => [entry, ...prev].slice(0, 30));
  }, []);

  const speak = useCallback((text: string) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.92; u.pitch = 0.82; u.volume = 1;
    u.onstart = () => setIsTalking(true);
    u.onend = () => setIsTalking(false);
    speechSynthesis.speak(u);
  }, []);

  const handsAction = useCallback(async (action: string, data: object) => {
    try {
      const r = await fetch(`/api/hands/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const j = await r.json();
      addLog('HANDS', 'success', `Executed ${action}: ${JSON.stringify(data)}`);
      return j;
    } catch (e) {
      addLog('HANDS', 'error', `Failed to execute ${action}`);
    }
  }, [addLog]);

  const visionAnalyze = useCallback(async (prompt: string) => {
    try {
      const r = await fetch('/api/vision/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      const d = await r.json();
      addLog('VISION', 'success', 'Screen captured and analyzed.');
      return d.analysis;
    } catch (e) {
      addLog('VISION', 'error', 'Vision agent offline.');
      return 'Vision systems offline, sir.';
    }
  }, [addLog]);

  const fireHapdabot = useCallback(async (message: string) => {
    try {
      await fetch('/api/railway/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, chatId: 999 })
      });
      addLog('HAPDABOT', 'success', `Command dispatched to Railway: ${message.slice(0, 50)}...`);
    } catch (e) {
      addLog('HAPDABOT', 'warning', 'Railway agent unreachable. Standing by.');
    }
  }, [addLog]);

  const chat = useCallback(async (text: string, systemPrompt: string, history: Message[]) => {
    const r = await fetch('/api/jarvis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 1000,
        messages: [
          { role: 'user', content: 'SYSTEM: ' + systemPrompt + ' Acknowledge and stay in character.' },
          { role: 'assistant', content: 'Understood, sir. HAPDA_BOT online. GREYNATION systems nominal. Awaiting your orders.' },
          ...history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          { role: 'user', content: text }
        ]
      })
    });
    const data = await r.json();
    return data?.choices?.[0]?.message?.content || 'Systems nominal, sir. Awaiting your command.';
  }, []);

  return {
    iq, setIq, logs, addLog, messages, setMessages,
    isThinking, setIsThinking, isTalking, setIsTalking,
    tokens, setTokens, autoLoop, setAutoLoop,
    speak, handsAction, visionAnalyze, fireHapdabot, chat
  };
}

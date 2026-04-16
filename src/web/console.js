// Hapdabot Command Center - Real-time Logic
const SUPABASE_URL = ''; // These will be injected or fetched
const SUPABASE_ANON_KEY = '';

const logStream = document.getElementById('logStream');
const consoleInput = document.getElementById('consoleInput');
const supabaseStatus = document.getElementById('supabaseStatus');
const activeMissionEl = document.getElementById('activeMission');
const objectivesList = document.getElementById('objectivesList');
const voiceHUD = document.getElementById('voiceHUD');
const micStatus = document.getElementById('micStatus');

class VoiceAssistant {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.speechQueue = [];
        this.isSpeaking = false;
        this.audioPlayer = new Audio();
        
        this.setupRecognition();
    }

    setupRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn("[voice] Browser does not support Speech Recognition.");
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';

        this.recognition.onstart = () => {
            this.isListening = true;
            micStatus.classList.add('active');
            console.log("[voice] Always Listening mode active.");
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            console.log(`[voice] Recognized: ${transcript}`);
            if (transcript) {
                handleCommand(transcript);
            }
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                console.log("[voice] Recognition ended. Restarting...");
                this.recognition.start();
            } else {
                micStatus.classList.remove('active');
            }
        };

        this.recognition.onerror = (event) => {
            console.error("[voice] Recognition error:", event.error);
            if (event.error === 'not-allowed') {
                this.isListening = false;
                micStatus.classList.remove('active');
                alert("Microphone access denied. Please allow mic for Always Listening mode.");
            }
        };
    }

    start() {
        if (this.recognition && !this.isListening) {
            this.recognition.start();
        }
    }

    async speak(text) {
        if (!text) return;
        this.speechQueue.push(text);
        if (!this.isSpeaking) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.speechQueue.length === 0) {
            this.isSpeaking = false;
            voiceHUD.classList.remove('speaking');
            return;
        }

        this.isSpeaking = true;
        const text = this.speechQueue.shift();
        voiceHUD.classList.add('speaking');

        try {
            const res = await fetch('/api/voice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            const data = await res.json();
            
            if (data.success && data.audioUrl) {
                this.audioPlayer.src = data.audioUrl;
                this.audioPlayer.play();
                
                await new Promise(resolve => {
                    this.audioPlayer.onended = resolve;
                    this.audioPlayer.onerror = resolve; // Skip on error
                });
            }
        } catch (e) {
            console.error("[voice] TTS playback failed:", e);
        }

        this.processQueue();
    }
}

const assistant = new VoiceAssistant();

async function init() {
    console.log("[console] Initializing Sequencer...");
    
    // 1. Fetch Status
    try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.success) updateUI(data.state);

        // 2. Connect to WebSocket Relay
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}`);

        ws.onopen = () => {
            supabaseStatus.innerHTML = '<span class="status-dot active"></span> LIVE_SYNC';
            console.log("[console] Secure WebSocket connected.");
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.type === 'heartbeat') {
                // Update all agent cards to 'online' state
                document.querySelectorAll('.agent-card').forEach(card => {
                    card.classList.add('online');
                });
                
                // Set a timeout to clear 'online' if no heartbeat received
                if (window.heartbeatTimeout) clearTimeout(window.heartbeatTimeout);
                window.heartbeatTimeout = setTimeout(() => {
                    document.querySelectorAll('.agent-card').forEach(card => {
                        card.classList.remove('online');
                    });
                }, 12000); // 12-second TTL for 5-second pulse
                return;
            }

            appendLog(data.agent, data.message, data.type);
            
            // Visual feedback - make specific agent card 'active'
            // We map Agent names like 'OPS_RESEARCHER' to id 'agent-researcher'
            const agentId = `agent-${data.agent.toLowerCase().replace('ops_', '').replace('strategic_', '').replace('growth_', '').replace('code_', '').replace('github_', '').replace('_systems', '')}`;
            const card = document.getElementById(agentId);
            if (card) {
                card.classList.add('active');
                setTimeout(() => card.classList.remove('active'), 2000);
            }

            // Sequential Audio Playback
            if (assistant) {
                if (data.type === 'error') {
                    // Critical Error Vocal Alert
                    assistant.speak(`Alert. Critical failure in ${data.agent} module. ${data.message}`);
                } else if (data.type === 'chat' || data.type === 'think') {
                    // Standard thought/chat voicing
                    assistant.speak(data.message);
                }
            }
        };

        ws.onclose = () => {
            supabaseStatus.innerHTML = '<span class="status-dot error"></span> RELAY_OFFLINE';
            console.warn("[console] WebSocket closed. Retrying in 5s...");
            setTimeout(init, 5000);
        };

    } catch (e) {
        console.error("[console] Init failed:", e);
        supabaseStatus.innerHTML = '<span class="status-dot error"></span> INIT_ERROR';
    }
}

function updateUI(state) {
    if (activeMissionEl) activeMissionEl.innerText = state.active_mission || 'IDLE';
    if (objectivesList) {
        objectivesList.innerHTML = state.objectives.map(o => `<li>${o}</li>`).join('') || '<li>No active objectives.</li>';
    }
}

function appendLog(agent, message, type = 'status') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-type-${type}`;
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    
    entry.innerHTML = `
        <span class="log-time">[${time}]</span>
        <span class="log-agent">${agent.toUpperCase()}</span>
        <span class="log-msg">${message}</span>
    `;

    logStream.appendChild(entry);
    logStream.scrollTop = logStream.scrollHeight;

    // Highlight Agent Card
    const cardId = `agent-${agent.toLowerCase()}`;
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.add('active');
        setTimeout(() => card.classList.remove('active'), 2000);
    }
}

consoleInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
        const cmd = consoleInput.value.trim();
        if (cmd) {
            appendLog('USER', cmd, 'chat');
            consoleInput.value = '';

            // Send to Hono Bridge
            try {
                const res = await fetch('/api/command', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: cmd })
                });
                const result = await res.json();
                if (result.success) {
                    appendLog('SYSTEM', result.message, 'think');
                    // assistant.speak(result.message); // Will already come via WS
                }
            } catch (err) {
                appendLog('SYSTEM', 'Bridge Error: Server unreachable.', 'error');
            }
        }
    }
});

async function handleCommand(cmd) {
    appendLog('USER', cmd, 'chat');
    try {
        await fetch('/api/command', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: cmd })
        });
    } catch (err) {
        appendLog('SYSTEM', 'Voice Bridge Error.', 'error');
    }
}

// Start Voice on interactions
document.body.addEventListener('click', () => assistant.start(), { once: true });
document.body.addEventListener('keydown', () => assistant.start(), { once: true });

init();

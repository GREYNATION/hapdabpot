import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import sound from 'sound-play';

const execAsync = promisify(exec);

const WHISPER_CLI = path.resolve('node_modules/nodejs-whisper/cpp/whisper.cpp/build/bin/Release/whisper-cli.exe');
const MODEL = path.resolve('node_modules/nodejs-whisper/cpp/whisper.cpp/models/ggml-base.en.bin');
const VOICE = 'en-US-AndrewNeural';

if (!fs.existsSync('voice_out')) fs.mkdirSync('voice_out');

export async function listen(seconds: number = 5): Promise<string> {
    const wav = 'mic_input.wav';
    console.log(`\n🎤 Recording ${seconds}s...`);
    await execAsync(`sox -t waveaudio default -r 16000 -c 1 -b 16 "${wav}" trim 0 ${seconds}`);
    console.log('🧠 Transcribing...');
    const { stdout } = await execAsync(`"${WHISPER_CLI}" -m "${MODEL}" -f "${wav}" -nt -np`);
    return stdout.trim();
}

export async function speak(text: string): Promise<void> {
    console.log(`🔊 Speaking: ${text.slice(0, 80)}${text.length > 80 ? '...' : ''}`);

    try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

        const stream = tts.toStream(text);
        const mp3Path = path.resolve('voice_out', `speech_${Date.now()}.mp3`);
        const out = fs.createWriteStream(mp3Path);

        await new Promise<void>((resolve, reject) => {
            stream.audioStream.pipe(out);
            stream.audioStream.on('end', () => out.end(() => resolve()));
            stream.audioStream.on('error', reject);
        });

        await new Promise(r => setTimeout(r, 200));
        await sound.play(mp3Path);

        try { fs.unlinkSync(mp3Path); } catch {}
    } catch (err: any) {
        console.error('TTS failed, fallback:', err.message);
        const safe = text.replace(/'/g, "''").replace(/\r?\n/g, ' ');
        const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('${safe}')`;
        await execAsync(`powershell -NoProfile -Command "${ps}"`);
    }
}
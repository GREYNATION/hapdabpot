// ============================================================
// OUT THE WAY â€” Shared Types & Character Definitions
// ============================================================

/** Agent status lifecycle */
export type AgentStatus = "idle" | "active" | "completed" | "failed";

/** A single log event emitted by any agent */
export interface AgentEvent {
    agent: AgentName;
    status: AgentStatus;
    message: string;
    timestamp: string; // ISO 8601
    output?: string;   // Optional serialized output summary
}

/** All recognized agent names in the system */
export type AgentName =
    | "story"
    | "scene"
    | "production"
    | "assembly"
    | "posting"
    | "marketing"
    | "music"
    | "monitoring";

// ============================================================
// CHARACTERS
// ============================================================

export interface Character {
    name: string;
    role: string;
    appearance: string;
    personality: string;
    voiceTone: string;
}

export const CHARACTERS: Record<string, Character> = {
    jace: {
        name: "Jace",
        role: "The street-smart lead. Mid-20s Black male. Caught between loyalty and ambition.",
        appearance: "Dark skin, sharp eyes, usually in hoodies or fitted streetwear. Tattoo on left forearm.",
        personality: "Calm under pressure, dry humor, fiercely loyal but carries deep pain.",
        voiceTone: "Low and measured, rarely raises his voice, speaks in short precise sentences."
    },
    nia: {
        name: "Nia",
        role: "Aspiring R&B artist and Jace's childhood sweetheart. Caught between her music dreams and their world.",
        appearance: "Brown-skinned, natural hair or protective styles, stylish but understated. Often has headphones.",
        personality: "Emotionally intelligent, creative, strong-willed â€” but carries secrets of her own.",
        voiceTone: "Warm, melodic speaking voice. Expressive. Sings under stress."
    },
    rel: {
        name: "Rel",
        role: "Jace's cousin and right-hand. Comic relief with a dangerous edge.",
        appearance: "Lighter complexion, stocky build, always in loud colors or fits. Fresh sneakers every episode.",
        personality: "Loud, funny, impulsive â€” but intensely protective of family.",
        voiceTone: "Fast talker, uses slang, exaggerates everything, lovable chaos energy."
    }
};

// ============================================================
// EPISODE / STORY SCHEMA
// ============================================================

export interface SceneDialogueLine {
    character: string;
    line: string;
}

export interface Scene {
    sceneNumber: number;
    location: string;           // e.g. "Jace's apartment, night"
    description: string;        // Prose description of what happens
    visualPrompt: string;       // AI image/video generation prompt (vertical 9:16)
    dialoguePrompt: string;     // AI voice synthesis prompt
    dialogue: SceneDialogueLine[];
    charactersPresent: string[];
    durationSeconds: number;    // Target clip duration (2â€“5 sec)
    clipPath?: string;          // Set by ProductionAgent after generation
    audioPath?: string;         // Set by ProductionAgent after generation
}

export interface Episode {
    episodeNumber: number;
    title: string;
    hook: string;               // Opening line / cold open teaser (â‰¤ 15 words)
    synopsis: string;           // 1-paragraph summary
    scenes: Scene[];
    cliffhanger: string;        // Final line / image beat that ends the episode
    previousSummary?: string;   // Injected from prior episode for continuity
    createdAt: string;          // ISO 8601
    finalVideoPath?: string;    // Set by AssemblyAgent
}

// ============================================================
// MUSIC SCHEMA (Nia Brooks)
// ============================================================

export interface MusicTrack {
    title: string;
    theme: string;
    mood: "soulful" | "emotional" | "hype" | "introspective" | "celebratory";
    lyrics: string;             // Full lyrics text
    lyricsPath?: string;        // Path to saved .txt file
    audioPath?: string;         // Path to generated .mp3
    episodeContext?: string;    // Which episode this relates to
    createdAt: string;
}

// ============================================================
// MARKETING SCHEMA
// ============================================================

export interface MarketingPackage {
    episodeNumber: number;
    caption: string;
    hashtags: string[];
    teaserClipPath?: string;    // Short clip (â‰¤ 10 sec) for promotion
    platforms: ("tiktok" | "instagram" | "youtube_shorts")[];
    createdAt: string;
}

// ============================================================
// POSTING SCHEMA
// ============================================================

export interface PostPayload {
    episodeNumber: number;
    videoPath: string;
    caption: string;
    hashtags: string[];
    platform: "tiktok" | "instagram" | "youtube_shorts";
    status: "queued" | "posted" | "failed";
    postId?: string;
    postedAt?: string;
    createdAt: string;
}

// ============================================================
// DASHBOARD SCHEMA (written by MonitoringAgent)
// ============================================================

export interface AgentStatusEntry {
    status: AgentStatus;
    lastUpdate: string;
    message?: string;
}

export interface Dashboard {
    episodeNumber: number;
    startedAt: string;
    lastUpdated: string;
    agents: Record<AgentName, AgentStatusEntry>;
    logs: AgentEvent[];
    finalVideoPath?: string;
    postStatus?: Record<string, PostPayload>;
}


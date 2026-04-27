# 🕷️ Spidey Jr. Auto-Scheduler · Integration Guide
## hapdabot (GREYNATION) · Railway Deployment

---

## 1. Drop the file

Place `ContentSchedulerAgent.ts` into:
```
src/agents/ContentSchedulerAgent.ts
```

---

## 2. Wire into your bot entry point

In `src/index.ts` (or wherever you initialize hapdabot), add:

```typescript
import { contentScheduler } from './agents/ContentSchedulerAgent';

// After bot is created:
contentScheduler.attachBot(bot);
contentScheduler.startScheduler();
```

---

## 3. Railway Environment Variables

Add these in your Railway service → Variables tab:

```
TIKTOK_ACCESS_TOKEN=your_tiktok_access_token
TIKTOK_OPEN_ID=your_tiktok_open_id
ADMIN_CHAT_ID=your_telegram_chat_id
VIDEO_DIR=/app/videos/spidey
```

> `TELEGRAM_BOT_TOKEN` should already be set from hapdabot core.

---

## 4. Add node-cron (if not already installed)

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

---

## 5. Add a Railway Volume for video storage

In Railway → your service → Storage:
- Add a volume mounted at `/app/videos/spidey`
- This is where you drop your rendered Veo .mp4 files

---

## 6. Video filename convention

Your Veo-rendered files must match these exact names:

| Episode | Filename |
|---------|----------|
| S01E01 First Swing | `s01e01_first_swing.mp4` |
| S01E02 Butterfly Rescue | `s01e02_butterfly.mp4` |
| S01E03 Birthday Surprise | `s01e03_birthday.mp4` |
| S01E04 Rainy Day Hero | `s01e04_rainy.mp4` |
| S01E05 Lost Puppy | `s01e05_puppy.mp4` |
| S01E06 Rainbow After Rain | `s01e06_rainbow.mp4` |
| S01E07 Lunch Hero | `s01e07_lunch.mp4` |
| S01E08 Bedtime Patrol | `s01e08_bedtime.mp4` |

---

## 7. Telegram Commands

Once deployed, control the scheduler from Telegram:

| Command | What it does |
|---------|-------------|
| `/content` | Full Season 1 dashboard — posted, ready, pending |
| `/schedule` | Shows next post windows + what's up next |
| `/post_now` | Immediately posts the next ready episode |
| `/mark_ready S01E01` | Flags an episode as having its video ready |

---

## 8. Posting Schedule

| Window | EST Time | UTC |
|--------|----------|-----|
| Morning | 7:00 AM | 12:00 UTC |
| Afternoon | 3:00 PM | 20:00 UTC |
| Evening | 8:00 PM | 01:00 UTC+1 |

Posts only fire if a video file is present. Missing file = skip + Telegram alert.

---

## 9. TikTok Access Token

Your token from the TikTok Developer Portal (stuyza.com OAuth app) needs:
- Scope: `video.upload` + `video.publish`
- Token refreshes every 24h — use your existing OAuth refresh flow in hapdabot

---

## 10. Production flow

```
Render in Veo 3.1
     ↓
Upload .mp4 to Railway Volume (/app/videos/spidey/)
     ↓
Telegram: /mark_ready S01E0X  (or scheduler auto-detects)
     ↓
Cron fires at 7AM / 3PM / 8PM EST
     ↓
TikTok Direct Post API v2 upload + publish
     ↓
Telegram confirmation with Publish ID
```

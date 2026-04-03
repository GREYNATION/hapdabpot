# SonicStream

Music royalty investment platform. Artists get funded upfront, investors earn when songs stream.

## Stack
- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- Supabase (auth + database + storage)
- TanStack Query
- Recharts
- Framer Motion

## Setup

1. Clone and install
```bash
cd sonicstream
npm install
```

2. Copy env file
```bash
cp .env.example .env
```

3. Add your Supabase credentials to `.env`

4. Run the schema in Supabase SQL editor
```
supabase_schema.sql
```

5. Start dev server
```bash
npm run dev
```

## Features

### For Investors
- Browse songs and artists on Discover page
- Buy royalty shares ($10/share, 10,000 shares per song)
- See live ROI projections before investing
- Tiered access based on share count:
  - 1-9 shares: Full audio stream
  - 10-24 shares: Audio + Music video
  - 25+ shares: Audio + Video + Behind the scenes + Unreleased content
- Portfolio dashboard with total value and holdings
- Royalties page with earnings history and payout trend chart
- Wallet with deposit and withdraw

### For Artists
- Upload songs with cover art, audio, and music video
- Set share price (min $10) and total shares (max 10,000)
- Mark songs as SonicStream-exclusive
- Analytics dashboard with stream counts and investor data
- Automatic royalty distribution to shareholders

### Investment Math
- 10,000 shares per song max
- $10/share minimum = $100,000 max raise per song
- Royalty rate: $0.004/stream (industry average)
- Example: 1M streams/month, 10 shares (0.1% ownership) = $4/month = 48% APY

## Deployment

Deploy to Railway or Vercel. Set env variables in platform dashboard.

# Poker Coach — Texas Hold'em

A single-player Texas Hold'em coaching app that teaches you to play better poker through adaptive coaching and realistic AI opponents.

## Features

- **6-max table** — you vs. 5 AI opponents
- **Precise odds** — Monte Carlo equity calculator (±0.5%) running in a Web Worker
- **5 AI archetypes** — Nit, TAG, LAG, Calling Station, Maniac with realistic stats
- **Adaptive coach** — levels 1–10, from beginner hand strength tips to GTO concepts
- **Both game modes** — Cash Game and Sit & Go tournament
- **Progress tracking** — XP, leveling, VPIP/PFR stats, hand history via IndexedDB

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Build

```bash
npm run build
```

## Tech Stack

- React 19 + TypeScript + Vite
- Zustand + Immer (state management)
- `phe` (O(1) hand evaluator), `pokersolver` (hand descriptions)
- Comlink + Web Worker (equity calculation off main thread)
- Dexie (IndexedDB — hand history + player profile)
- TailwindCSS 4

# 🛡️ Rift Analyst — League of Legends AI Agent

A conversational AI agent that analyzes League of Legends players and answers
current-patch meta questions. Built with the **Vercel AI SDK** and **Claude
Haiku 4.5**, deployable to Vercel and runnable locally.

**🔗 Live demo: [league-chatbot.vercel.app](https://league-chatbot.vercel.app)**

> Ask it: _"Analyze Faker#KR1 on kr"_, _"Who counters Darius top?"_,
> _"Best build and runes for Jinx this patch?"_

## What it does

The agent has two complementary tool sets and decides which to call:

| Capability | Data source | Why |
| --- | --- | --- |
| Player profile, rank, win rate, recent match stats | **Official Riot Games API** (`account-v1`, `summoner-v4`, `league-v4`, `match-v5`) | Ground truth for player data — everything else is built on top of it |
| Champion meta, builds, runes, items, counters, tier lists (current patch) | **OP.GG MCP server** (`mcp-api.op.gg/mcp`) | Free, official, AI-native; aggregates millions of ranked games |

### Why these sources

- **Riot API over scraping op.gg/u.gg:** op.gg and u.gg both sit on top of the
  Riot API. Going direct gives authoritative data, no ToS risk, and real API
  engineering (auth, region routing, rate limits).
- **OP.GG MCP over scraping lolalytics:** lolalytics has no stable public API;
  community scrapers are unmaintained and break on layout changes. OP.GG's MCP
  server exposes the same kind of meta/build/counter data through a sanctioned,
  structured interface designed for agents.

## Architecture

```
Browser (useChat UI)
   └── POST /api/chat
         └── streamText(model: claude-haiku-4-5)  ← Anthropic API
               ├── Riot tools      src/lib/riot.ts   (custom, typed)
               └── OP.GG MCP tools src/lib/opgg.ts   (discovered at runtime)
```

The model runs a tool loop (up to 12 steps): e.g. for a player analysis it
calls `lookupSummoner` → `getMatchHistory`, then synthesizes the result.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:3000
```

You need two keys:

1. **`RIOT_API_KEY`** — generate at <https://developer.riotgames.com> (dev keys
   expire every 24h; request a production key for permanent hosting).
2. **`ANTHROPIC_API_KEY`** — from <https://console.anthropic.com>. Powers the
   Claude Haiku 4.5 agent.

The OP.GG MCP server needs no key. If it's unreachable, the agent degrades
gracefully and still answers player-stats questions via the Riot API.

## Run with Docker

The app builds to a standalone Next.js server in a small Alpine image.

```bash
docker build -t rift-analyst .
docker run -p 3000:3000 --env-file .env.local rift-analyst
```

On macOS without Docker Desktop, use a headless daemon:

```bash
brew install docker colima && colima start
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel            # preview deployment
vercel --prod     # production
```

Add `RIOT_API_KEY` and `ANTHROPIC_API_KEY` in the Vercel dashboard
(Project → Settings → Environment Variables), or via
`vercel env add <NAME> production`.

## Stack

Next.js 16 (App Router) · Vercel AI SDK v6 · Claude Haiku 4.5 (Anthropic API) ·
Model Context Protocol (OP.GG) · TypeScript · Tailwind CSS · Docker.

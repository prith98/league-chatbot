# 🛡️ Rift Analyst — League of Legends AI Agent

A conversational AI agent that analyzes League of Legends players, compares them
head-to-head, recommends champions, and answers current-patch meta questions.
Built with the **Vercel AI SDK** and **Claude Haiku 4.5**, deployable to Vercel
and runnable locally.

**🔗 Live demo: [league-chatbot.vercel.app](https://league-chatbot.vercel.app)**

> Ask it: _"Analyze Faker#KR1 on kr"_, _"Compare Faker#KR1 and Chovy#KR1"_,
> _"Who counters Darius top?"_, _"What jungler should I play to carry?"_,
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

### Features

- **Single-player analysis** — `analyzePlayerStats` renders an overview card
  with a radar chart (win rate, KDA, kill participation, damage share, CS/min,
  DPM, survivability) plus role split and top champions over the last ~25 ranked
  games. Interpretation is role-aware — a support's low CS isn't flagged as a
  weakness.
- **Side-by-side comparison** — `comparePlayerStats` puts two players (any
  regions, Solo/Flex/both) on one card with an overlaid radar. Role-dependent
  stats are compared *relative to each player's role average*, and win-rate gaps
  within sample-size noise are called out as noise rather than a "winner".
- **Champion recommendations** — pulls the live lane tier list and filters by
  playstyle (carry, tanky, engage, …) with reasons and when *not* to pick.
- **Team draft planner** — `analyzeTeam` reads 2–5 players' role affinity, recent
  form (~25 ranked games each) and deep champion pools, then returns a suggested
  role assignment for the group, factoring in any bans or known enemy picks.
- **Patch-aware** — the current patch is fetched at runtime and every meta
  answer is grounded in tool data, never the model's stale training knowledge.

## Architecture

```
Browser (useChat UI + rich tool cards)
   └── POST /api/chat
         └── streamText(model: claude-haiku-4-5)  ← Anthropic API
               ├── Riot tools      src/lib/riot.ts   (custom, typed)
               │     lookupSummoner · getMatchHistory · getChampionMastery
               │     analyzePlayerStats · comparePlayerStats · analyzeTeam
               └── OP.GG MCP tools src/lib/opgg.ts   (discovered at runtime)
```

The model runs a tool loop (up to 12 steps), grounding every answer in tool
output. The current patch is injected into the system prompt at request time
(`src/lib/patch.ts`). Tool results stream back as interactive cards
(`src/components/ToolCard.tsx`), and player stats are drawn as an SVG radar
(`src/components/StatRadar.tsx`).

Match details are immutable, so `riot.ts` caches each game by ID and shares the
in-flight request — in a 5-stack, where teammates share most of their recent
games, this collapses the duplicate fetches into one Riot call so a team
overview can read the same depth as a 1v1 comparison.

### Riot API rate limits

> **Rule:** the Riot API key is capped at **20 requests/second** (Riot's dev-key
> per-application limit; production keys are higher but the same mechanism
> applies). Bursting past it returns **HTTP 429** and drops games from a query.

A deep query fetches one match-detail request *per game*, so analyzing the last
50 games means ~50 requests — fired all at once via `Promise.all`, that instantly
blows the 20 req/s cap. To stay under it, **every** Riot call funnels through a
single shared rate limiter in `riotFetch` (`src/lib/riot.ts`): each request
reserves the next evenly-spaced time slot, so the global request rate is paced
just below the ceiling no matter how many queries (or team-overview players) are
in flight at once. Combined with the immutable-match cache above, a 50-game pull
completes in a few seconds without ever tripping a 429.

The cap defaults to a safe **18 req/s** (margin under 20) and is configurable via
the `RIOT_MAX_RPS` env var — raise it when running on a production key.

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
Model Context Protocol (OP.GG) · React 19 · react-markdown · TypeScript ·
Tailwind CSS v4 · Docker.

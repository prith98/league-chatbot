import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { riotTools } from "@/lib/riot";
import { loadOpggTools } from "@/lib/opgg";

// Multi-step tool calls + remote MCP can take a while.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are a League of Legends analysis assistant. You help players understand their performance and the current meta.

You have two sets of tools:
- Riot API tools (lookupSummoner, getMatchHistory, getChampionMastery): the source of truth for a SPECIFIC player's profile, rank, recent match stats, and champion pool. Use these whenever the user asks about a named player. A Riot ID looks like "Name#TAG".
- OP.GG tools: champion meta, builds, runes, item choices, counters, synergies, and tier lists for the CURRENT patch. Use these for "what should I build", "who counters X", "is Y good right now", and recommendations.

Guidelines:
- ALWAYS use the Riot tools (lookupSummoner, getMatchHistory, getChampionMastery) for player profile and match data — never any other source. getMatchHistory is intentionally restricted to RANKED Summoner's Rift games (Solo/Duo and Flex); ARAM and other modes are excluded by design, so all per-game analysis is ranked-only.
- When a user asks to analyze a player, call lookupSummoner first, then getMatchHistory (and getChampionMastery for their main champions), then summarize: rank, win rate, most-played champions, KDA and CS trends, and concrete areas to improve.
- When recommending builds or champions, prefer OP.GG data and mention it reflects the current patch.
- If the user gives a player name without a #TAG or region, ask for the Riot ID and region (default na1).
- Be concise and use markdown: short sections, bullet points, and tables for stats. Don't dump raw JSON.
- If a tool fails (e.g. expired Riot key), explain the issue plainly and what to do.`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const opggTools = await loadOpggTools();

  const result = streamText({
    // Direct Anthropic provider — reads ANTHROPIC_API_KEY from the environment.
    model: anthropic("claude-haiku-4-5"),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: { ...riotTools, ...opggTools },
    stopWhen: stepCountIs(12),
  });

  return result.toUIMessageStreamResponse();
}

import { dynamicTool, jsonSchema, type ToolSet } from "ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * OP.GG's official, free MCP server. Provides champion meta / builds / runes /
 * counters / tier lists by patch, plus item metadata and esports data.
 * Built for AI agents — no API key required.
 * https://github.com/opgginc/opgg-mcp
 */
const OPGG_MCP_URL = process.env.OPGG_MCP_URL ?? "https://mcp-api.op.gg/mcp";

// Cache the connection across warm serverless invocations.
let clientPromise: Promise<Client> | null = null;

async function getClient(): Promise<Client> {
  if (!clientPromise) {
    clientPromise = (async () => {
      const client = new Client(
        { name: "league-chatbot", version: "1.0.0" },
        { capabilities: {} },
      );
      const transport = new StreamableHTTPClientTransport(new URL(OPGG_MCP_URL));
      await client.connect(transport);
      return client;
    })();
  }
  return clientPromise;
}

interface McpToolDef {
  name: string;
  description?: string;
  inputSchema: unknown;
}

interface McpCallResult {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

/**
 * Discover the OP.GG MCP tools and expose them as AI SDK tools the model can
 * call. Returns an empty set (and logs) if the server is unreachable, so the
 * agent still works with Riot tools alone.
 */
export async function loadOpggTools(): Promise<ToolSet> {
  try {
    const client = await getClient();
    const { tools } = (await client.listTools()) as { tools: McpToolDef[] };

    const toolSet: ToolSet = {};
    // Keep only League of Legends tools — the server also exposes TFT/Valorant
    // tools we don't want cluttering this agent's tool list.
    //
    // Also exclude OP.GG's player/match tools: those overlap with our Riot tools
    // and aren't ranked-filtered. We want all player data to flow through the
    // Riot tools (source of truth, restricted to ranked Summoner's Rift).
    const exclude = new Set([
      "lol_get_summoner_profile",
      "lol_get_summoner_game_detail",
      "lol_list_summoner_matches",
    ]);
    for (const t of tools.filter((t) => t.name.startsWith("lol_") && !exclude.has(t.name))) {
      toolSet[t.name] = dynamicTool({
        description: t.description ?? `OP.GG tool: ${t.name}`,
        inputSchema: jsonSchema((t.inputSchema as object) ?? { type: "object", properties: {} }),
        execute: async (args) => {
          const result = (await client.callTool({
            name: t.name,
            arguments: (args ?? {}) as Record<string, unknown>,
          })) as McpCallResult;

          // MCP returns content parts; flatten text for the model.
          const text = (result.content ?? [])
            .map((c) => (c.type === "text" ? c.text : JSON.stringify(c)))
            .join("\n");
          return text || JSON.stringify(result);
        },
      });
    }
    return toolSet;
  } catch (err) {
    console.error("Failed to load OP.GG MCP tools:", err);
    clientPromise = null; // allow reconnect next time
    return {};
  }
}

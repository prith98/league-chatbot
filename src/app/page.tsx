"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { ToolCard, type ToolPart } from "@/components/ToolCard";
import { RiftEmblem } from "@/components/RiftEmblem";
import { PLATFORMS } from "@/lib/regions";

const SUGGESTIONS = [
  { tag: "Player", text: "Analyze Faker#KR1 on the kr region" },
  { tag: "Matchup", text: "Who counters Darius top right now?" },
  { tag: "Build", text: "Best build and runes for Jinx this patch" },
  { tag: "Meta", text: "What are the strongest mid laners currently?" },
];

// Riot platform codes — shared with the server-side Zod enum.
const REGIONS = PLATFORMS;

interface PlayerField {
  riotId: string;
  region: string;
}

function isToolPart(type: string): boolean {
  return type === "dynamic-tool" || type.startsWith("tool-");
}

export default function Page() {
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
  const [showCompare, setShowCompare] = useState(false);
  const [cmpA, setCmpA] = useState<PlayerField>({ riotId: "", region: "na1" });
  const [cmpB, setCmpB] = useState<PlayerField>({ riotId: "", region: "na1" });
  const busy = status === "submitted" || status === "streaming";
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function submit(text: string) {
    if (!text.trim() || busy) return;
    sendMessage({ text });
    setInput("");
  }

  function submitCompare() {
    const a = cmpA.riotId.trim();
    const b = cmpB.riotId.trim();
    if (!a || !b || busy) return;
    // Spell out the exact platform codes so the agent passes them straight
    // through to comparePlayerStats' region enum (no natural-language guessing).
    submit(
      `Compare these two players over their last 25 ranked games using comparePlayerStats. ` +
        `Player A: riotId "${a}", region "${cmpA.region}". ` +
        `Player B: riotId "${b}", region "${cmpB.region}".`,
    );
    setShowCompare(false);
  }

  const empty = messages.length === 0;

  return (
    <main className="relative mx-auto flex h-dvh w-full max-w-3xl flex-col px-4 sm:px-6">
      {/* arcane watermark — depth behind the conversation */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        <RiftEmblem size={640} className="animate-spin-slow opacity-[0.04]" />
      </div>

      {/* ───────── Header ───────── */}
      <header className="pt-6 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 animate-bloom rounded-full bg-arcane/20 blur-md" />
            {busy && <StreamRing />}
            <RiftEmblem size={46} className="relative" />
          </div>
          <div className="min-w-0">
            <h1 className="wordmark text-xl font-semibold leading-none sm:text-2xl">
              RIFT ANALYST
            </h1>
            <p className="mt-1.5 text-[0.7rem] uppercase tracking-[0.22em] text-parch-dim sm:text-xs">
              Summoner&apos;s Rift Intelligence
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 rounded-full border border-gold-deep/40 bg-navy/60 px-3 py-1.5 text-[0.65rem] uppercase tracking-wider text-parch sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-arcane opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-arcane" />
            </span>
            Haiku&nbsp;4.5
          </div>
        </div>
        <div className="hex-divider mt-4" />
      </header>

      {/* ───────── Conversation ───────── */}
      <div
        className={
          "flex-1 overflow-y-auto pb-6 pt-1 " +
          (empty ? "flex flex-col justify-center" : "space-y-5")
        }
      >
        {empty && (
          <div className="animate-rise pb-8">
            <div className="mb-7 text-center">
              <p className="text-[0.7rem] uppercase tracking-[0.3em] text-gold/80">
                Channel the data
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-cream sm:text-[1.7rem]">
                Scout any player, matchup, or meta
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-parch">
                Live player records from the Riot API, fused with champion meta
                &amp; builds from OP.GG — read on the current patch.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={s.text}
                  onClick={() => submit(s.text)}
                  style={{ animationDelay: `${120 + i * 80}ms` }}
                  className="group relative animate-rise overflow-hidden rounded-lg border border-gold-deep/45 bg-gradient-to-b from-panel/80 to-navy/90 p-4 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:shadow-[0_8px_30px_-12px_rgba(10,200,185,0.45)]"
                >
                  {/* hover sheen — arcane bloom from the corner */}
                  <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(130%_120%_at_0%_0%,rgba(10,200,185,0.14),transparent_55%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  {/* left rune accent */}
                  <span className="absolute left-0 top-1/2 h-0 w-[2px] -translate-y-1/2 bg-gradient-to-b from-gold to-gold-deep transition-all duration-300 group-hover:h-3/4" />

                  <span className="relative inline-flex items-center rounded-full border border-gold-deep/50 bg-void/50 px-2.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.18em] text-gold/80 transition-colors group-hover:text-gold">
                    {s.tag}
                  </span>
                  <span className="relative mt-2.5 flex items-start gap-2 text-sm leading-snug text-cream/90">
                    <span className="flex-1">{s.text}</span>
                    <span className="mt-0.5 shrink-0 text-gold/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-gold">
                      →
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div
            key={m.id}
            className={
              "animate-rise " +
              (m.role === "user" ? "flex justify-end" : "flex justify-start gap-3")
            }
          >
            {m.role === "assistant" && (
              <RiftEmblem size={26} className="mt-1 shrink-0 opacity-80" />
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[85%] rounded-xl rounded-tr-sm border border-gold-deep/50 bg-gradient-to-br from-gold-deep/20 to-navy/60 px-4 py-2.5 text-sm leading-relaxed text-cream"
                  : "min-w-0 flex-1 rounded-xl rounded-tl-sm border border-arcane/15 bg-panel/70 px-4 py-3 text-sm leading-relaxed text-cream shadow-[inset_0_1px_0_rgba(240,230,210,0.04)]"
              }
            >
              {m.parts.map((part, i) => {
                if (part.type === "text") {
                  return m.role === "user" ? (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  ) : (
                    <Markdown key={i}>{part.text}</Markdown>
                  );
                }
                if (isToolPart(part.type)) {
                  return <ToolCard key={i} part={part as unknown as ToolPart} />;
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-3">
            <RiftEmblem size={26} className="shrink-0 opacity-80" />
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.2em] text-parch">
              <span className="h-1.5 w-1.5 rounded-full bg-arcane" style={{ animation: "hex-pulse 1.2s ease-in-out infinite" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-arcane" style={{ animation: "hex-pulse 1.2s ease-in-out 0.2s infinite" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-arcane" style={{ animation: "hex-pulse 1.2s ease-in-out 0.4s infinite" }} />
              <span className="ml-2 text-parch-dim">consulting the rift</span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-loss/40 bg-loss/10 px-4 py-3 text-sm text-loss/90">
            The connection to the rift faltered. Ensure <code className="font-mono text-loss">RIOT_API_KEY</code> and{" "}
            <code className="font-mono text-loss">ANTHROPIC_API_KEY</code> are set in{" "}
            <code className="font-mono text-loss">.env.local</code>.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ───────── Console ───────── */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="pb-5 pt-2"
      >
        <div className="mb-3 flex justify-center">
          <button
            type="button"
            onClick={() => setShowCompare(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold-deep/45 bg-navy/60 px-3.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.15em] text-gold/80 transition-all hover:border-gold/60 hover:text-gold"
          >
            <span>⚔️</span> Compare two players
          </button>
        </div>
        <div className="hex-divider mb-4" />
        <div className="group flex items-center gap-2 rounded-lg border border-gold-deep/50 bg-navy/70 px-2 py-2 transition-all duration-300 focus-within:border-arcane/60 focus-within:shadow-[0_0_28px_-8px_rgba(10,200,185,0.45)]">
          <RiftEmblem size={22} className="ml-1.5 shrink-0 opacity-50 transition-opacity group-focus-within:opacity-90" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a player or the current meta…"
            className="flex-1 bg-transparent px-1 py-1.5 text-sm text-cream placeholder:text-parch-dim focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-md border border-loss/40 bg-loss/10 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-loss transition hover:bg-loss/20"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-md border border-gold/60 bg-gradient-to-b from-gold/25 to-gold-deep/25 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-gold-bright transition-all hover:from-gold/40 hover:to-gold-deep/40 hover:shadow-[0_0_18px_-4px_rgba(200,170,110,0.6)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:shadow-none"
            >
              Send
            </button>
          )}
        </div>
        <p className="mt-2.5 text-center text-[0.65rem] text-parch-dim">
          Player data · Riot API &nbsp;·&nbsp; Meta &amp; builds · OP.GG &nbsp;·&nbsp; Reasoned by Claude
        </p>
      </form>

      {/* ───────── Compare modal ───────── */}
      {showCompare && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/80 px-4 backdrop-blur-sm"
          onClick={() => setShowCompare(false)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              submitCompare();
            }}
            className="w-full max-w-md animate-rise rounded-xl border border-gold-deep/50 bg-gradient-to-b from-panel to-navy p-5 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">⚔️</span>
              <h3 className="font-display text-lg text-gold-bright">Compare Players</h3>
              <button
                type="button"
                onClick={() => setShowCompare(false)}
                className="ml-auto text-parch transition-colors hover:text-gold"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="mb-4 mt-1 text-xs text-parch-dim">
              Last 25 ranked games · Solo/Duo &amp; Flex · regions can differ
            </p>

            <PlayerInput label="Player 1" value={cmpA} onChange={setCmpA} />
            <PlayerInput label="Player 2" value={cmpB} onChange={setCmpB} />

            <button
              type="submit"
              disabled={!cmpA.riotId.trim() || !cmpB.riotId.trim() || busy}
              className="mt-2 w-full rounded-md border border-gold/60 bg-gradient-to-b from-gold/25 to-gold-deep/25 py-2.5 text-xs font-semibold uppercase tracking-wider text-gold-bright transition-all hover:from-gold/40 hover:to-gold-deep/40 hover:shadow-[0_0_18px_-4px_rgba(200,170,110,0.6)] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:shadow-none"
            >
              Compare
            </button>
          </form>
        </div>
      )}
    </main>
  );
}

function PlayerInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: PlayerField;
  onChange: (v: PlayerField) => void;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-[0.65rem] uppercase tracking-[0.15em] text-gold/70">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          value={value.riotId}
          onChange={(e) => onChange({ ...value, riotId: e.target.value })}
          placeholder="Name#TAG"
          className="min-w-0 flex-1 rounded-md border border-gold-deep/50 bg-navy/70 px-3 py-2 text-sm text-cream placeholder:text-parch-dim focus:border-arcane/60 focus:outline-none"
        />
        <select
          value={value.region}
          onChange={(e) => onChange({ ...value, region: e.target.value })}
          className="rounded-md border border-gold-deep/50 bg-navy/70 px-2 py-2 text-sm text-cream focus:border-arcane/60 focus:outline-none"
        >
          {REGIONS.map((r) => (
            <option key={r} value={r} className="bg-navy text-cream">
              {r}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

/** Channeling ring — orbits the emblem while the agent works. */
function StreamRing() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 h-[66px] w-[66px] -translate-x-1/2 -translate-y-1/2">
      <span className="absolute inset-0 rounded-full border border-gold/25" />
      {/* counter-rotating dashed rune ring */}
      <span
        className="absolute inset-[3px] animate-spin rounded-full border border-dashed border-gold/30"
        style={{ animationDuration: "9s", animationDirection: "reverse" }}
      />
      {/* orbiting arcane node */}
      <span className="absolute inset-0 animate-spin" style={{ animationDuration: "6s" }}>
        <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-arcane shadow-[0_0_8px_2px_rgba(10,200,185,0.7)]" />
      </span>
    </span>
  );
}

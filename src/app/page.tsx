"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, Mark } from "@/components/ui/icons";
import { Button } from "@/components/ui/controls";
import {
  ANALYSES,
  AnalysisForms,
  AnalysisPicker,
  type AnalysisId,
} from "@/components/chat/analyses";
import { Composer } from "@/components/chat/Composer";
import { Turn, Working, type UIMessage } from "@/components/chat/Conversation";
import { EmptyState } from "@/components/chat/EmptyState";

/* ============================================================================
   The shell

   Desktop is a two-pane workspace: a rail that keeps the four analyses
   permanently reachable, and a document column for the conversation. Mobile
   collapses the rail to a bar and moves the analyses behind a sheet, because
   240px of navigation on a 390px screen is not navigation.
   ========================================================================= */

export default function Page() {
  const { messages, sendMessage, status, stop, error, setMessages, clearError } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const [input, setInput] = useState("");
  const [picker, setPicker] = useState(false);
  const [form, setForm] = useState<AnalysisId | null>(null);

  const busy = status === "submitted" || status === "streaming";
  const empty = messages.length === 0;

  /* ---- Scrolling ---------------------------------------------------------
     The old implementation called scrollIntoView on every render, which yanked
     the page back down whenever a long report streamed in while you were
     reading the one above it. Now the view only follows the stream while you
     are already at the bottom; step away and a button offers the way back. */
  const scroller = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(true);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 140);
  }, []);

  const toBottom = useCallback((smooth = true) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useLayoutEffect(() => {
    // Never on the empty state — the landing view must open at its headline,
    // not at the bottom of the page.
    if (empty || !pinned) return;
    toBottom(messages.length > 1);
  }, [messages, status, pinned, empty, toBottom]);

  const submit = useCallback(
    (text: string) => {
      if (!text.trim() || busy) return;
      clearError?.();
      setPinned(true);
      sendMessage({ text });
      setInput("");
    },
    [busy, clearError, sendMessage],
  );

  const openAnalysis = useCallback((id: AnalysisId) => {
    setPicker(false);
    setForm(id);
  }, []);

  function newSession() {
    stop();
    setMessages([]);
    setInput("");
    setPinned(true);
  }

  // Cmd/Ctrl+K focuses the composer from anywhere — the one shortcut a person
  // in a hurry will try.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        document.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-dvh w-full overflow-hidden">
      {/* ───────── Rail (desktop) ───────── */}
      <aside className="hidden w-[var(--rail)] shrink-0 flex-col border-r border-edge bg-s1/40 lg:flex">
        <div className="px-5 pb-5 pt-6">
          <Wordmark />
        </div>

        <nav aria-label="Analyses" className="px-3">
          <p className="label px-2 pb-2">Analyses</p>
          <ul className="space-y-0.5">
            {ANALYSES.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setForm(a.id)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[length:var(--step-ui)] text-t2 transition-colors hover:bg-s2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
                >
                  <span className="shrink-0 text-t3">
                    <Icon name={a.icon} size={15} />
                  </span>
                  <span className="truncate">{a.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto px-3 pb-5">
          {!empty && (
            <button
              type="button"
              onClick={newSession}
              className="mb-4 flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[length:var(--step-ui)] text-t2 transition-colors hover:bg-s2 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
            >
              <span className="shrink-0 text-t3">
                <Icon name="restart" size={15} />
              </span>
              New session
            </button>
          )}
          <div className="rule rule-start mb-3" />
          <dl className="space-y-1.5 px-2">
            {[
              { term: "Players", value: "Riot API" },
              { term: "Meta", value: "OP.GG MCP" },
            ].map((row) => (
              <div key={row.term} className="flex items-baseline gap-2">
                <dt className="label w-12 shrink-0">{row.term}</dt>
                <dd className="m-0 text-[length:var(--step-label)] text-t2">{row.value}</dd>
              </div>
            ))}
            <div className="flex items-baseline gap-2">
              <dt className="label w-12 shrink-0">Agent</dt>
              <dd className="m-0 flex items-center gap-1.5 text-[length:var(--step-label)] text-t2">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full bg-t2 ${busy ? "animate-breathe" : "opacity-40"}`}
                />
                Haiku 4.5
              </dd>
            </div>
          </dl>
        </div>
      </aside>

      {/* ───────── Main column ───────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bar (mobile) */}
        <header className="flex shrink-0 items-center gap-3 border-b border-edge px-4 py-3 lg:hidden">
          <Wordmark compact />
          <div className="ml-auto flex items-center gap-1">
            {!empty && (
              <Button variant="ghost" size="sm" onClick={newSession} className="!px-2">
                <Icon name="restart" size={16} />
                <span className="sr-only">New session</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setPicker(true)}>
              Analyses
            </Button>
          </div>
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            ref={scroller}
            onScroll={onScroll}
            className="h-full overflow-y-auto overscroll-contain px-4 sm:px-6"
          >
            <div className="mx-auto w-full max-w-[var(--measure)] pb-10">
              {empty ? (
                <EmptyState onPick={openAnalysis} onAsk={submit} />
              ) : (
                <div className="pt-6">
                  {(messages as unknown as UIMessage[]).map((m, i) => (
                    <Turn key={m.id} message={m} first={i === 0} />
                  ))}
                  {status === "submitted" && <Working />}

                  {/* Streaming text char-by-char into a live region would flood
                      a screen reader, so only the transition is announced. */}
                  <p aria-live="polite" className="sr-only">
                    {busy ? "Rift Analyst is working." : "Answer ready."}
                  </p>

                  {error && (
                    <div
                      role="alert"
                      className="mt-5 rounded-xl border border-edge bg-s1 p-4 sm:p-5"
                    >
                      <p className="flex items-center gap-2 text-[length:var(--step-body)] font-medium text-t1">
                        <span className="text-down">
                          <Icon name="alert" size={16} />
                        </span>
                        That request didn&apos;t come back
                      </p>
                      <p className="mt-1.5 max-w-[60ch] text-[length:var(--step-ui)] leading-relaxed text-t2">
                        The analysis service didn&apos;t respond. Riot&apos;s API rate-limits
                        bursts, so a second attempt often works.
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button size="sm" onClick={() => clearError?.()}>
                          Dismiss
                        </Button>
                        <details className="text-[length:var(--step-label)] text-t3">
                          <summary className="cursor-pointer select-none py-1">
                            Running this locally?
                          </summary>
                          <p className="mono mt-1.5 leading-relaxed">
                            Set RIOT_API_KEY and ANTHROPIC_API_KEY in .env.local. Riot dev keys
                            expire every 24 hours.
                          </p>
                        </details>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Only offered when it is actually needed. */}
          {!empty && !pinned && (
            <button
              type="button"
              onClick={() => {
                setPinned(true);
                toBottom();
              }}
              className="animate-rise absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-edge2 bg-s2 px-3.5 py-2 text-[length:var(--step-ui)] text-t1 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.8)] transition-colors hover:bg-s3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1"
            >
              <Icon name="arrowDown" size={14} />
              Jump to latest
            </button>
          )}
        </div>

        <Composer
          value={input}
          onChange={setInput}
          onSubmit={() => submit(input)}
          onStop={stop}
          busy={busy}
          onOpenAnalyses={() => setPicker(true)}
        />
      </div>

      <AnalysisPicker open={picker} onClose={() => setPicker(false)} onPick={openAnalysis} />
      <AnalysisForms
        active={form}
        onClose={() => setForm(null)}
        onSubmit={submit}
        busy={busy}
      />
    </div>
  );
}

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 text-t1">
        <Mark size={compact ? 24 : 28} />
      </span>
      <span className="min-w-0">
        <h1 className="display truncate text-[length:var(--step-lead)] text-t1">Rift Analyst</h1>
        {!compact && <p className="label mt-1">Ranked scouting</p>}
      </span>
    </div>
  );
}

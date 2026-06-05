"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { ToolCard, type ToolPart } from "@/components/ToolCard";

const SUGGESTIONS = [
  "Analyze Faker#KR1 on the kr region",
  "Who counters Darius top right now?",
  "Best build and runes for Jinx this patch",
  "What are the strongest mid laners currently?",
];

function isToolPart(type: string): boolean {
  return type === "dynamic-tool" || type.startsWith("tool-");
}

export default function Page() {
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const [input, setInput] = useState("");
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

  return (
    <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col px-3 sm:px-4">
      <header className="border-b border-slate-800 py-3 sm:py-4">
        <h1 className="text-lg font-bold text-slate-100 sm:text-xl">🛡️ Rift Analyst</h1>
        <p className="text-xs text-slate-400 sm:text-sm">
          Player analysis (Riot API) + champion meta &amp; builds (OP.GG) · Claude Haiku 4.5
        </p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-5">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Try asking:</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-lg border border-slate-800 bg-slate-900/50 p-3 text-left text-sm text-slate-300 transition hover:border-slate-600 hover:bg-slate-800"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[88%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed " +
                (m.role === "user" ? "bg-blue-600 text-white" : "w-full bg-slate-800/80 text-slate-100")
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

        {status === "submitted" && <div className="text-sm text-slate-500">Thinking…</div>}
        {error && (
          <div className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            Something went wrong. Check that <code>RIOT_API_KEY</code> and{" "}
            <code>ANTHROPIC_API_KEY</code> are set in <code>.env.local</code>.
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="border-t border-slate-800 py-3 sm:py-4"
      >
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about a player or the current meta…"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
          {busy ? (
            <button
              type="button"
              onClick={stop}
              className="rounded-lg bg-slate-700 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-600"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-40"
            >
              Send
            </button>
          )}
        </div>
      </form>
    </main>
  );
}

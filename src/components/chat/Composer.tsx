"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/controls";
import { Icon } from "@/components/ui/icons";

/**
 * The composer.
 *
 * A textarea rather than an input, because "compare these two smurfs on euw
 * over their last 50 flex games" is a sentence, not a search term. It grows to
 * eight lines and then scrolls. Enter sends, Shift+Enter breaks the line — the
 * convention every chat product shares, stated in the hint rather than assumed.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  busy,
  onOpenAnalyses,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  busy: boolean;
  onOpenAnalyses: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Auto-size: reset then match content, capped so the composer never eats the
  // conversation.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    // Empty keeps its single-row height; a long placeholder must not inflate it.
    if (value) el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="border-t border-edge bg-ink/85 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto w-full max-w-[var(--measure)]">
        <div className="flex items-end gap-2 rounded-xl border border-edge bg-s1 p-2 transition-colors focus-within:border-edge2">
          <button
            type="button"
            onClick={onOpenAnalyses}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-t2 transition-colors hover:bg-s3 hover:text-t1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-t1 lg:hidden"
          >
            <Icon name="plus" size={18} />
            <span className="sr-only">Start a structured analysis</span>
          </button>

          <textarea
            ref={ref}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="Ask about a player or the meta…"
            aria-label="Ask about a player, a matchup, or the current patch"
            className="min-h-9 flex-1 resize-none overflow-y-auto bg-transparent px-1.5 py-2 text-[length:var(--step-body)] leading-6 text-t1 placeholder:text-t3 focus:outline-none"
          />

          {busy ? (
            <Button type="button" onClick={onStop} size="sm" className="mb-0.5 h-9 shrink-0">
              <Icon name="stop" size={14} />
              Stop
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!value.trim()}
              className="mb-0.5 h-9 w-9 shrink-0 !px-0"
            >
              <Icon name="send" size={17} />
              <span className="sr-only">Send</span>
            </Button>
          )}
        </div>

        <p className="mt-2 text-center text-[length:var(--step-label)] text-t3">
          <span className="hidden sm:inline">Enter to send · Shift+Enter for a new line · </span>
          Player data from the Riot API · meta from OP.GG · reasoned by Claude
        </p>
      </div>
    </form>
  );
}

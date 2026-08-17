"use client";

import { Markdown } from "@/components/Markdown";
import { ReportView, RunLog } from "@/components/tools/ToolCard";
import { isReport, type ToolPart } from "@/components/tools/types";

export interface UIPart {
  type: string;
  text?: string;
  [k: string]: unknown;
}

export interface UIMessage {
  id: string;
  role: string;
  parts: UIPart[];
}

const isToolPart = (type: string) => type === "dynamic-tool" || type.startsWith("tool-");

type Block =
  | { kind: "text"; text: string }
  | { kind: "steps"; parts: ToolPart[] }
  | { kind: "report"; part: ToolPart };

/**
 * Fold a message's parts into display blocks.
 *
 * The agent interleaves prose with up to a dozen tool calls. Runs of plain
 * lookups collapse into one log so the report the person asked for is not
 * buried under six identical panels — that was the single worst thing about
 * the previous transcript.
 */
function toBlocks(parts: UIPart[]): Block[] {
  const out: Block[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      if (part.text?.trim()) out.push({ kind: "text", text: part.text });
      continue;
    }
    if (!isToolPart(part.type)) continue;
    const tool = part as unknown as ToolPart;
    if (isReport(tool)) {
      out.push({ kind: "report", part: tool });
      continue;
    }
    const last = out[out.length - 1];
    if (last?.kind === "steps") last.parts.push(tool);
    else out.push({ kind: "steps", parts: [tool] });
  }
  return out;
}

/**
 * A turn reads as a section of a document rather than a pair of speech
 * bubbles: the question is a heading, the answer is the body under it. On a
 * wide screen that removes the empty right-hand gutter a chat layout leaves
 * behind, and it makes a long transcript scannable by question.
 */
export function Turn({ message, first }: { message: UIMessage; first: boolean }) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("");
    return (
      <article className="animate-rise">
        {!first && <div className="rule mb-6" />}
        <p className="label mb-1.5">You asked</p>
        <p className="max-w-[60ch] whitespace-pre-wrap text-[length:var(--step-lead)] font-medium leading-snug text-t1">
          {text}
        </p>
      </article>
    );
  }

  const blocks = toBlocks(message.parts);
  if (blocks.length === 0) return null;

  return (
    <article className="animate-rise mt-4">
      {blocks.map((b, i) => {
        /* Prose is held to a readable measure; a report is allowed the full
           column, because a table of eight metrics is not a paragraph. */
        if (b.kind === "text")
          return (
            <div key={i} className="max-w-[66ch]">
              <Markdown>{b.text}</Markdown>
            </div>
          );
        if (b.kind === "steps") return <RunLog key={i} parts={b.parts} />;
        return <ReportView key={i} part={b.part} />;
      })}
    </article>
  );
}

/** Shown while the agent has accepted a question but not yet said anything. */
export function Working() {
  return (
    <p
      role="status"
      className="mono mt-4 inline-flex items-center gap-2 text-[length:var(--step-label)] uppercase tracking-[0.09em] text-t2"
    >
      <span className="animate-breathe inline-block h-1.5 w-1.5 rounded-full bg-t2" />
      Reading the ranked history
    </p>
  );
}

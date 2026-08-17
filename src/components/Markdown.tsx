import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Prose styling for the agent's written answers.
 *
 * Links are underlined rather than coloured — the palette reserves hue for
 * data, and an underline is the stronger affordance anyway. Inline code and
 * table figures switch to the mono face, matching the rule used everywhere
 * else: if it is a measurement, it is monospaced.
 */
const components: Components = {
  p: (props) => <p className="my-2.5 first:mt-0 last:mb-0 text-t1" {...props} />,
  ul: (props) => (
    <ul className="my-2.5 list-disc space-y-1 pl-5 marker:text-t3" {...props} />
  ),
  ol: (props) => (
    <ol className="my-2.5 list-decimal space-y-1 pl-5 marker:text-t3" {...props} />
  ),
  li: (props) => <li className="pl-0.5 text-t1" {...props} />,
  h1: (props) => (
    <h1
      className="display mb-2 mt-5 text-[length:var(--step-title)] text-t1 first:mt-0"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="display mb-2 mt-5 text-[length:var(--step-lead)] text-t1 first:mt-0"
      {...props}
    />
  ),
  h3: (props) => <h3 className="label mb-1.5 mt-4 first:mt-0" {...props} />,
  a: (props) => (
    <a
      className="text-t1 underline decoration-t3 underline-offset-[3px] transition-colors hover:decoration-t1"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  strong: (props) => <strong className="font-semibold text-t1" {...props} />,
  em: (props) => <em className="text-t2" {...props} />,
  code: (props) => (
    <code
      className="mono rounded bg-s2 px-1.5 py-0.5 text-[0.85em] text-t1 ring-1 ring-edge"
      {...props}
    />
  ),
  hr: () => <div className="rule my-5" />,
  blockquote: (props) => (
    <blockquote className="my-3 border-l-2 border-edge2 pl-3 text-t2" {...props} />
  ),
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-lg border border-edge">
      <table className="w-full border-collapse text-left" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="label border-b border-edge bg-s2 px-2.5 py-2 font-normal"
      {...props}
    />
  ),
  td: (props) => (
    <td
      className="mono border-t border-edge px-2.5 py-1.5 text-[length:var(--step-ui)] text-t1 first:font-sans"
      {...props}
    />
  ),
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

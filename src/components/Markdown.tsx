import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0 text-cream/90" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5 marker:text-gold/60" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5 marker:text-gold/60" {...props} />,
  li: (props) => <li className="leading-relaxed text-cream/90" {...props} />,
  h1: (props) => <h1 className="mb-2 mt-3 font-display text-lg font-semibold text-gold-bright" {...props} />,
  h2: (props) => <h2 className="mb-2 mt-3 font-display text-base font-semibold text-gold-bright" {...props} />,
  h3: (props) => (
    <h3 className="mb-1 mt-2 text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-gold/80" {...props} />
  ),
  a: (props) => (
    <a className="text-arcane underline decoration-arcane/40 underline-offset-2 transition-colors hover:text-arcane-deep" target="_blank" rel="noreferrer" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-gold-bright" {...props} />,
  em: (props) => <em className="text-parch" {...props} />,
  code: (props) => (
    <code className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[0.8em] text-arcane ring-1 ring-gold-deep/30" {...props} />
  ),
  hr: () => <hr className="my-3 border-gold-deep/30" />,
  blockquote: (props) => (
    <blockquote className="my-2 border-l-2 border-gold/50 pl-3 text-parch italic" {...props} />
  ),
  table: (props) => (
    <div className="my-2.5 overflow-x-auto rounded-md border border-gold-deep/30">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-navy/60" {...props} />,
  th: (props) => (
    <th className="border-b border-gold-deep/40 px-2.5 py-1.5 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-gold/80" {...props} />
  ),
  td: (props) => <td className="border-t border-gold-deep/15 px-2.5 py-1.5 text-cream/90" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mb-2 mt-3 text-lg font-bold" {...props} />,
  h2: (props) => <h2 className="mb-2 mt-3 text-base font-bold" {...props} />,
  h3: (props) => <h3 className="mb-1 mt-2 text-sm font-semibold text-slate-200" {...props} />,
  a: (props) => (
    <a className="text-blue-400 underline hover:text-blue-300" target="_blank" rel="noreferrer" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-white" {...props} />,
  code: (props) => (
    <code className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[0.8em] text-amber-200" {...props} />
  ),
  hr: () => <hr className="my-3 border-slate-700" />,
  table: (props) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="border-b border-slate-600" {...props} />,
  th: (props) => <th className="px-2 py-1 text-left font-semibold text-slate-300" {...props} />,
  td: (props) => <td className="border-t border-slate-700/60 px-2 py-1" {...props} />,
};

export function Markdown({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
}

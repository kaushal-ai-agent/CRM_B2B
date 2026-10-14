import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * MarkdownRenderer component using react-markdown and remark-gfm.
 * Configured with Tailwind Typography for "Pragmatic Modernism" styling.
 */
export default function MarkdownRenderer({ content }) {
  if (!content) return null;

  return (
    <div className="prose prose-slate max-w-none text-xs leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full border-collapse border border-slate-300 text-xs font-mono" {...props} />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th className="border border-slate-300 px-3 py-2 bg-slate-50 text-left font-semibold" {...props} />
          ),
          td: ({ node, ...props }) => (
            <td className="border border-slate-300 px-3 py-2" {...props} />
          ),
          p: ({ node, ...props }) => (
            <p className="m-0 mb-2 last:mb-0" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-4 my-2 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-4 my-2 space-y-1" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="m-0 p-0" {...props} />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-slate-900" {...props} />
          ),
          code: ({ node, inline, ...props }) =>
            inline ? (
              <code className="font-mono text-xs bg-slate-100 px-1 py-0.5 border border-slate-200" {...props} />
            ) : (
              <pre className="font-mono text-xs bg-slate-100 p-2 overflow-x-auto border border-slate-200 my-2">
                <code {...props} />
              </pre>
            ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

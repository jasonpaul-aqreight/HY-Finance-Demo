'use client';

import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <MarkdownHooks
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-sm border-collapse border border-foreground/20" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50" {...props}>{children}</thead>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-foreground/20 px-3 py-1.5 text-left font-semibold text-foreground" {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-foreground/20 px-3 py-1.5 text-foreground" {...props}>{children}</td>
          ),
          p: ({ children, ...props }) => (
            <p className="text-foreground mb-2 leading-relaxed" {...props}>{children}</p>
          ),
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>{children}</strong>
          ),
          li: ({ children, ...props }) => (
            <li className="text-foreground" {...props}>{children}</li>
          ),
        }}
      >
        {content}
      </MarkdownHooks>
    </div>
  );
}

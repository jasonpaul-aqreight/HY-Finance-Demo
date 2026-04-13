'use client';

import { MarkdownHooks } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="max-w-none text-sm text-foreground leading-[1.7]">
      <MarkdownHooks
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-6">
              <table className="min-w-full text-sm border-collapse border border-foreground/20" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/50" {...props}>{children}</thead>
          ),
          th: ({ children, ...props }) => (
            <th className="border border-foreground/20 px-3 py-2 text-left font-semibold text-foreground" {...props}>{children}</th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-foreground/20 px-3 py-2 text-foreground" {...props}>{children}</td>
          ),
          p: ({ children, node, ...props }) => {
            // Detect subtitle paragraphs: a <p> whose only child is <strong> ending with ":"
            const mdChildren = node?.children;
            const isBoldOnly = mdChildren?.length === 1
              && mdChildren[0].type === 'element'
              && mdChildren[0].tagName === 'strong';
            const strongText = isBoldOnly && mdChildren?.[0].type === 'element'
              ? mdChildren[0].children
                  .filter((c): c is { type: 'text'; value: string } => c.type === 'text')
                  .map(c => c.value)
                  .join('')
              : '';
            const isSubtitle = isBoldOnly && strongText.endsWith(':');

            if (isSubtitle) {
              return (
                <p className="text-foreground font-semibold underline pt-6 mb-0" {...props}>
                  {strongText}
                </p>
              );
            }
            return (
              <p className="text-foreground my-0" {...props}>{children}</p>
            );
          },
          strong: ({ children, ...props }) => (
            <strong className="font-semibold text-foreground" {...props}>{children}</strong>
          ),
          li: ({ children, ...props }) => (
            <li className="text-foreground" {...props}>{children}</li>
          ),
          ul: ({ children, ...props }) => (
            <ul className="my-1 ml-5 list-disc" {...props}>{children}</ul>
          ),
          ol: ({ children, ...props }) => (
            <ol className="my-1 ml-5 list-decimal" {...props}>{children}</ol>
          ),
        }}
      >
        {content}
      </MarkdownHooks>
    </div>
  );
}

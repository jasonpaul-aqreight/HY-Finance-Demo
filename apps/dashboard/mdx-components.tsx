import type { MDXComponents } from "mdx/types";

export function useMDXComponents(
  components: MDXComponents
): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl font-bold tracking-tight mb-6" style={{ color: '#1F4E79' }}>
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold mt-10 mb-4" style={{ color: '#1F4E79' }}>
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold mt-6 mb-3 text-foreground">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-base leading-7 mb-4 text-foreground">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc pl-6 mb-4 space-y-1 text-foreground">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal pl-6 mb-4 space-y-1 text-foreground">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-base leading-7">{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    hr: () => <hr className="my-8 border-border" />,
    table: ({ children }) => (
      <div className="my-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">{children}</table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-muted/50">{children}</thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2.5 text-left font-semibold text-foreground border-b border-border">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2.5 text-foreground border-b border-border">
        {children}
      </td>
    ),
    ...components,
  };
}

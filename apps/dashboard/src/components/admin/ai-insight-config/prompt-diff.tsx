// Shared line-diff helpers for prompt comparison views (DiffModal,
// HistoryDropdown). Per Phase-2 lessons-learned: surgical edits and history
// snapshots both preserve most lines verbatim, so a per-line set-membership
// check is enough to highlight changes without pulling in a diff library.

interface DiffLine {
  status: 'same' | 'added' | 'removed';
  text: string;
}

export function diffLines(currentText: string, proposedText: string): {
  left: DiffLine[];
  right: DiffLine[];
} {
  const currentLines = currentText.split('\n');
  const proposedLines = proposedText.split('\n');
  const proposedSet = new Set(proposedLines);
  const currentSet = new Set(currentLines);

  const left: DiffLine[] = currentLines.map((line) => ({
    text: line,
    status: proposedSet.has(line) ? 'same' : 'removed',
  }));
  const right: DiffLine[] = proposedLines.map((line) => ({
    text: line,
    status: currentSet.has(line) ? 'same' : 'added',
  }));

  return { left, right };
}

export function DiffPane({
  title,
  lines,
  changeColor,
}: {
  title: string;
  lines: DiffLine[];
  changeColor: 'red' | 'green';
}) {
  const changeBg =
    changeColor === 'red'
      ? 'bg-red-100 text-red-900'
      : 'bg-emerald-100 text-emerald-900';

  return (
    <div className="flex flex-col rounded-lg border border-border bg-background min-h-0">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold text-foreground">
        {title}
      </div>
      <div className="flex-1 overflow-auto p-0 text-sm font-mono leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={
              line.status === 'same'
                ? 'whitespace-pre-wrap break-words px-3 py-0.5 text-foreground'
                : `whitespace-pre-wrap break-words px-3 py-0.5 ${changeBg}`
            }
          >
            {line.text === '' ? ' ' : line.text}
          </div>
        ))}
      </div>
    </div>
  );
}

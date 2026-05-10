// Shared word counter for AI Insight feedback.
// English-only: whitespace-split, ignores empty tokens.

export const FEEDBACK_MAX_WORDS = 80;

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

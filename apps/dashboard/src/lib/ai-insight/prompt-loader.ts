// Loads AI Insight prompts from the ai_insight_prompts table.
//
// One in-memory snapshot is reused across all reads within a 30s TTL so a
// single analysis run (1 system + N component fetches) hits Postgres at most
// once. Writes invalidate the snapshot; the next read repopulates it.
//
// On DB miss/error, falls back to the factory defaults imported from
// prompts-defaults.ts. This is a safety net for first-boot before the seed
// endpoint runs — not a bypass. Misses are logged.

import { getPool } from '../postgres';
import {
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_FEEDBACK_ROUTER_SYSTEM,
  DEFAULT_SURGICAL_EDITOR_SYSTEM,
  DEFAULT_SECTION_GUIDANCE,
} from './prompts-defaults';

const CACHE_TTL_MS = 30_000;

export type PromptCategory = 'system' | 'component' | 'section_guidance';

export interface PromptRow {
  promptKey: string;
  promptText: string;
  previousText: string | null;
  previousText2: string | null;
  category: PromptCategory;
  page: string | null;
  sectionKey: string | null;
  sectionName: string | null;
  componentType: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
  displayName: string;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
}

interface Snapshot {
  loadedAt: number;
  byKey: Map<string, string>;
  rows: PromptRow[];
}

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

async function loadSnapshot(): Promise<Snapshot> {
  const pool = getPool();
  const { rows } = await pool.query<{
    prompt_key: string;
    prompt_text: string;
    previous_text: string | null;
    previous_text_2: string | null;
    category: PromptCategory;
    page: string | null;
    section_key: string | null;
    section_name: string | null;
    component_type: 'kpi' | 'chart' | 'table' | 'breakdown' | null;
    display_name: string;
    sort_order: number;
    updated_at: Date;
    updated_by: string | null;
  }>(`
    SELECT prompt_key, prompt_text, previous_text, previous_text_2,
           category, page, section_key, section_name,
           component_type, display_name, sort_order, updated_at, updated_by
    FROM ai_insight_prompts
    ORDER BY category, sort_order, prompt_key
  `);

  const byKey = new Map<string, string>();
  const promptRows: PromptRow[] = rows.map((r) => {
    byKey.set(r.prompt_key, r.prompt_text);
    return {
      promptKey: r.prompt_key,
      promptText: r.prompt_text,
      previousText: r.previous_text,
      previousText2: r.previous_text_2,
      category: r.category,
      page: r.page,
      sectionKey: r.section_key,
      sectionName: r.section_name,
      componentType: r.component_type,
      displayName: r.display_name,
      sortOrder: r.sort_order,
      updatedAt: r.updated_at.toISOString(),
      updatedBy: r.updated_by,
    };
  });

  return { loadedAt: Date.now(), byKey, rows: promptRows };
}

async function getSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.loadedAt < CACHE_TTL_MS) return snapshot;
  if (inflight) return inflight;
  inflight = loadSnapshot()
    .then((s) => {
      snapshot = s;
      return s;
    })
    .catch((err) => {
      console.warn('[prompt-loader] snapshot load failed, callers will fall back to defaults:', err);
      // Empty snapshot — every getter falls back to the default. Cache briefly
      // so a broken DB doesn't generate per-request warnings.
      const empty: Snapshot = { loadedAt: Date.now(), byKey: new Map(), rows: [] };
      snapshot = empty;
      return empty;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function invalidateCache(): void {
  snapshot = null;
}

export async function getGlobalSystemPrompt(): Promise<string> {
  const s = await getSnapshot();
  const text = s.byKey.get('global_system');
  if (text) return text;
  console.warn('[prompt-loader] DB miss for global_system, using default');
  return DEFAULT_GLOBAL_SYSTEM;
}

export async function getSummarySystemPrompt(): Promise<string> {
  const s = await getSnapshot();
  const text = s.byKey.get('summary_system');
  if (text) return text;
  console.warn('[prompt-loader] DB miss for summary_system, using default');
  return DEFAULT_SUMMARY_SYSTEM;
}

export async function getFeedbackRouterSystemPrompt(): Promise<string> {
  const s = await getSnapshot();
  const text = s.byKey.get('feedback_router_system');
  if (text) return text;
  console.warn('[prompt-loader] DB miss for feedback_router_system, using default');
  return DEFAULT_FEEDBACK_ROUTER_SYSTEM;
}

export async function getSurgicalEditorSystemPrompt(): Promise<string> {
  const s = await getSnapshot();
  const text = s.byKey.get('surgical_editor_system');
  if (text) return text;
  console.warn('[prompt-loader] DB miss for surgical_editor_system, using default');
  return DEFAULT_SURGICAL_EDITOR_SYSTEM;
}

export async function getComponentPrompt(componentKey: string): Promise<string> {
  const s = await getSnapshot();
  const text = s.byKey.get(componentKey);
  if (text) return text;
  const fallback = DEFAULT_COMPONENT_PROMPTS[componentKey];
  if (fallback) {
    console.warn(`[prompt-loader] DB miss for component ${componentKey}, using default`);
    return fallback;
  }
  throw new Error(`No prompt defined for component: ${componentKey}`);
}

// Section Guidance prompt key convention: `<section_key>_guidance`.
// Returns null if no guidance is defined and no default exists — callers
// (buildSummaryUserPrompt) should skip injection in that case.
export function sectionGuidanceKey(sectionKey: string): string {
  return `${sectionKey}_guidance`;
}

export async function getSectionGuidance(sectionKey: string): Promise<string | null> {
  const s = await getSnapshot();
  const key = sectionGuidanceKey(sectionKey);
  const text = s.byKey.get(key);
  if (text && text.trim()) return text;
  const fallback = DEFAULT_SECTION_GUIDANCE[sectionKey];
  if (fallback && fallback.trim()) {
    console.warn(`[prompt-loader] DB miss for section guidance ${key}, using default`);
    return fallback;
  }
  return null;
}

export async function getAllPrompts(): Promise<PromptRow[]> {
  const s = await getSnapshot();
  return s.rows;
}

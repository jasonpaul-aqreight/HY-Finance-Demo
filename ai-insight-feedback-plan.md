# AI Insight Feedback Loop

## Context

End users currently cannot tell us when an AI insight is wrong, awkward, or unhelpful — feedback only flows to admins via word-of-mouth, and the admin then has to manually figure out which prompt to edit. We want a loop where any user can submit feedback from the insight panel, an LLM routes it to the right component prompt and compacts it to bullets, and an admin reviews/applies it via a tick → LLM-driven surgical edit. Admin keeps the existing manual-edit, reset-to-default, and now also a 2-step history (last 2 versions).

## End-State Flow (after all phases)

1. User clicks **Feedback** in `AiInsightPanel` footer (all pages) → popup textbox → Save → toast.
2. `POST /api/ai-insight/feedback` runs **Router LLM** (tool-use, Haiku 4.5) → picks `target_prompt_key` from the section's components + compacts feedback to bullets → inserts row into `ai_insight_feedback`.
3. Admin sees count **badge** in sidebar (total) and on the prompt card in `PromptTree` (per-prompt).
4. Admin selects the prompt → `PromptEditor` shows pending feedback list under the textarea, each row has **tick** / **cross**.
5. **Tick** → `POST .../preview` runs **Surgical Editor LLM** (Sonnet 4.6) → returns proposed text + 1-line change note → diff modal → **Confirm** → `POST .../apply` rotates `previous_text_2 = previous_text`, `previous_text = prompt_text`, `prompt_text = proposed`, deletes feedback row.
6. **Cross** → `DELETE .../[id]` (hard delete).
7. Admin can also use the **History** dropdown (current / previous / previous-2) to revert; manual save also rotates history.

---

## Phasing Overview

| Phase | Scope | Session |
|---|---|---|
| **1 — MVP** | End-to-end submit · Router LLM · Admin sees feedback · Discard only. **All pages.** | Session 1 |
| **2 — Apply** | Surgical Editor LLM · Diff modal · Apply with history rotation | Session 2 |
| **3 — Polish** | Manual save/reset rotate history · History dropdown + revert · 2 system prompts seeded in admin UI · Sidebar total badge | Session 3 |

Each phase is independently shippable. Schema is added incrementally per phase (one migration per phase, grouped with the code that uses it).

---

## Tracker

Tick boxes as each item completes. Annotate with date + commit hash on completion.

### Phase 1 — MVP
- [x] `migrations/017_ai_insight_feedback.sql` created (run locally — pending user)
- [x] `lib/ai-insight/feedback-llm.ts` — `routeAndCompact()` (Haiku 4.5, tool-use enum)
- [x] `feedback_router_system` prompt added to `prompts-defaults.ts` + seeded via `seed-defaults` (re-run pending user)
- [x] `POST /api/ai-insight/feedback` end-to-end (router + insert + return)
- [x] `GET /api/admin/ai-insight-feedback` returns list (filter by `?prompt_key=`)
- [x] `DELETE /api/admin/ai-insight-feedback/[id]` hard deletes
- [x] `GET /api/admin/ai-insight-prompts` extended with `feedbackCount`
- [x] Feedback button visible in `AiInsightPanel` on every page (via `InsightSectionHeader`)
- [x] `FeedbackModal` opens, saves, closes
- [x] `Toast` shows on success
- [x] `PromptTree` shows count badge per prompt + rolled up on section/page
- [x] `PromptEditor` lists pending feedback under textarea via `FeedbackList`
- [x] Discard button hard-deletes & UI updates (SWR mutate)
- [ ] Playwright run on Payment → Payment Collection Trend → end-to-end (pending user)
- [x] `tsc --noEmit` + `eslint` pass on apps/dashboard
- [ ] Phase 1 committed (pending user)

### Phase 2 — Apply
- [x] `migrations/018_prompts_history.sql` (`previous_text`, `previous_text_2`) created + run
- [x] `surgical_editor_system` prompt added to `prompts-defaults.ts` + seeded
- [x] `proposeSurgicalEdit()` in `feedback-llm.ts`
- [x] `POST /api/admin/ai-insight-feedback/[id]/preview`
- [x] `POST /api/admin/ai-insight-feedback/[id]/apply` (transactional rotation + delete row)
- [x] `DiffModal` component (current vs proposed + change summary)
- [x] Tick button wires preview → diff → confirm → apply
- [x] Playwright: tick → diff → confirm; verify rotation + row deletion
- [x] `tsc --noEmit` passes
- [ ] Phase 2 committed (pending user)

### Phase 3 — Polish
- [x] PUT `/api/admin/ai-insight-prompts/[prompt_key]` rotates history (centralised via `rotateAndWrite` in `prompt-store.ts`)
- [x] Reset endpoint rotates history (single + reset-all both rotate)
- [x] `POST /api/admin/ai-insight-prompts/[prompt_key]/revert` (`{ to: 'previous' | 'previous_2' }`) — rotates so revert is itself reversible
- [x] `HistoryDropdown` component in `PromptEditor` (popover list + wide diff modal preview)
- [x] Both new system prompts visible in `PromptTree` System section (verified via GET; sort order 2 + 3)
- [x] `AppSidebar` shows total pending feedback badge (admin-only, 30s SWR poll)
- [ ] Playwright: manual save rotates · revert restores · sidebar badge updates (browser locked by another session — API path verified end-to-end via curl: save→prev rotation, save→prev2 rotation, revert previous, revert previous_2, reset rotation; pending user UI sweep)
- [x] `tsc --noEmit` passes
- [x] `eslint` passes on modified files
- [ ] Phase 3 committed (pending user)

---

## Lessons Learned

Append after each phase. Goal: surface anything that changes the next phase's plan (router accuracy, surprise files, missing primitives, model behavior, etc.).

Format:
```
### YYYY-MM-DD — Phase N
- Lesson (1 line)
- Why it matters / what to change next phase
```

### 2026-05-09 — Phase 3
- All four mutation paths (manual save / reset / reset-all / revert) now share the same `previous_text_2 ← previous_text, previous_text ← prompt_text, prompt_text ← new` rotation. The Phase-2 `apply` path keeps its inline rotation because it also needs `SELECT … FOR UPDATE` on the feedback row in the same transaction; extracting a single shared helper would have meant threading a `pg.PoolClient` through `prompt-store.ts` for one caller. The duplication is one SQL statement and is worth the simpler module boundary.
  - Why it matters: future mutation paths (e.g. import-from-file, bulk-replace) should call `rotateAndWrite()` from `prompt-store.ts` instead of writing their own UPDATE.
- Revert intentionally rotates instead of just swapping. After `revert to previous`: the value being replaced (the current text) moves into `previous_text`, so the admin can immediately `revert to previous` again to undo. Verified via curl: save A → save B → revert previous → revert previous restores B again.
  - Why it matters: makes the history dropdown safe to play with — every revert is reversible — which is the right model for an editorial undo, not a destructive rollback.
- The `HistoryDropdown` is a Popover trigger that opens a wide `Dialog` for the diff preview. Two separate primitives (not nested), with the dialog driven by an internal `previewSlot` state — clicking Revert in the popover sets the slot, opening the dialog. Phase-2's pattern of "parent owns open/close" doesn't apply because this component owns both the trigger and the preview, so it owns the open state too.
  - Why it matters: future per-row affordances (e.g. an inline "compare with default" button) can use the same pattern — popover for the menu, separate dialog for any diff/preview surface.
- `feedback_router_system` and `surgical_editor_system` already render under "System Prompts" in `PromptTree` because the tree groups by `category='system'` from the GET response — no UI change was needed for Phase-3's "system prompts visible in tree" item. The lock at `PromptEditor.tsx:79` (`NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS !== 'false'`) means they are view-only by default; admins must opt out via env var to edit them. This matches the existing `global_system` / `summary_system` behaviour and is the right default — these prompts shape every feedback round-trip.
  - Why it matters: don't be surprised that "edit feedback router" requires the env var flip; it's intentional, not missing wiring.
- Sidebar badge revalidates via SWR every 30s plus on every admin discard/apply (FeedbackList now mutates `'/api/admin/ai-insight-feedback'` after both). User-side feedback POST does NOT trigger sidebar revalidation directly — that user is typically not admin in the same session, and the 30s poll covers cross-session drift.
  - Why it matters: don't add a `mutate` to the public POST path "for completeness"; it would be a no-op in the user's browser and wasted bytes.

### 2026-05-09 — Phase 2
- The set-based line-diff in `DiffModal.tsx` (membership of each line in the other side's Set) gives a perfectly readable highlight for surgical edits because the editor LLM preserves untouched lines verbatim. A real LCS diff library would be over-engineering — Phase 3's revert/history-dropdown UI can reuse the same simple approach when showing previous_text vs current.
  - Why it matters: avoids a dependency for a problem that doesn't need one given how the surgical editor behaves.
- Surgical editor (Sonnet 4.6) on the first feedback (Sales → Sales Summary, "Drop invoice/cash mix") produced a clean minimal diff and a 100-char change summary on the first try — no retries, no enum drift, no extra commentary. Tool-use forcing + the explicit "smallest possible diff" rule in the system prompt are doing the work; do not loosen them in Phase 3.
  - Why it matters: keeps surgical edits trustworthy enough that admins can confirm without re-reading the whole prompt.
- The apply route rotates history inside a single transaction with `SELECT … FOR UPDATE` on the feedback row, so a concurrent discard cannot delete the row out from under an in-flight apply. Phase 3's manual-save and reset paths must use the same rotation pattern (and probably the same shared helper) so all four paths (apply / save / reset / revert) keep the two-step history invariant.
  - Why it matters: history rotation is the one thing that can corrupt silently if any path forgets to rotate; centralising it in Phase 3 is worth the small refactor.
- The diff modal needs `sm:max-w-5xl` + a fixed `h-[60vh]` grid because the default dialog popup is `sm:max-w-sm`, which would crop side-by-side prompt text. Phase 3's HistoryDropdown preview (current vs previous vs previous-2) should use the same wide modal pattern.
  - Why it matters: avoids re-discovering the sizing fight when adding the third compare view.

### 2026-05-08 — Phase 1
- The router system prompt is wired through `getFeedbackRouterSystemPrompt()` in `prompt-loader.ts`, mirroring the existing `getGlobalSystemPrompt` / `getSummarySystemPrompt` pattern. Phase 2's surgical-editor system prompt should use the same dedicated-getter pattern (not generic `getSystemPrompt(key)`).
  - Why it matters: keeps the loader's fallback behavior + cache semantics consistent.
- `PromptTree` rendering of trailing badges/dots was inconsistent (mixed `ml-auto` on individual elements). I refactored each level (system / page / section / component) to wrap trailing items in `<div className="ml-auto flex ...">`. Phase 3 should reuse that container when it adds the History dropdown affordance per row.
  - Why it matters: avoids alignment drift as more trailing affordances are added.
- The dashboard ESLint rule `react-hooks/set-state-in-effect` rejected calling `setVisible(false)` inside the toast's `useEffect`. Solution was to derive visibility directly from the `message` prop and only use the effect to schedule auto-dismiss. Phase 2's `DiffModal` should similarly avoid setState-in-effect — derive from props.
  - Why it matters: future modal/banner work should be designed so visible state is derived, not toggled inside an effect.
- Seed for new system prompts (`feedback_router_system`) requires `POST /api/admin/ai-insight-prompts/seed-defaults` to be hit after migration (`ON CONFLICT DO NOTHING` is idempotent). Phase 2 will need the same after adding `surgical_editor_system` — flag this in user verification steps each phase.
  - Why it matters: forgetting the seed POST = `[prompt-loader] DB miss for feedback_router_system` warnings + falls back to default text (still works, but admin UI won't show the prompt).

---

## Phase 1 — MVP

### Goal
User can submit feedback from any AI Insight panel; router LLM routes & compacts; admin sees feedback in `/admin/ai-insight-config` under the right prompt; admin can discard. **No surgical editing or history yet.**

### DB
New file: `migrations/017_ai_insight_feedback.sql`

```sql
CREATE TABLE ai_insight_feedback (
  id            SERIAL PRIMARY KEY,
  section_key   TEXT NOT NULL,
  page          TEXT NOT NULL,
  raw_feedback  TEXT NOT NULL,
  compact_feedback TEXT NOT NULL,
  target_prompt_key TEXT NOT NULL REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE,
  submitted_by  TEXT,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feedback_target ON ai_insight_feedback(target_prompt_key);
```

### LLM
- Add `feedback_router_system` to [prompts-defaults.ts](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts), seeded with `category='system'`, sorted after existing system prompts so it shows in `PromptTree`'s System section (read-only display in P1; editable end-to-end in P3 once history rotation lands — until then editing it works but no history).
- New file: `apps/dashboard/src/lib/ai-insight/feedback-llm.ts`
  - `routeAndCompact({ section_key, page, raw_feedback })`:
    - Builds the section's component list from `SECTION_COMPONENTS` ([prompts.ts](apps/dashboard/src/lib/ai-insight/prompts.ts#L11)).
    - Loads system prompt via `getComponentPrompt('feedback_router_system')` (or new dedicated getter).
    - Calls Anthropic with `tool_choice: { type: "tool", name: "select_target" }`. Tool schema:
      ```ts
      { target_prompt_key: enum<string>, compact_feedback: string }
      ```
    - Returns `{ target_prompt_key, compact_feedback }`.
  - Model: `process.env.AI_INSIGHT_FEEDBACK_ROUTER_MODEL || 'claude-haiku-4-5-20251001'`.
  - Reuses [getAnthropicClient()](apps/dashboard/src/lib/ai-insight/client.ts#L5).

### API
- New `POST /api/ai-insight/feedback` — body `{ section_key, page, raw_feedback, submitted_by }` → calls `routeAndCompact()` → INSERT → returns `{ id, target_prompt_key }`.
- New `GET /api/admin/ai-insight-feedback?prompt_key=…` — returns `[{ id, raw_feedback, compact_feedback, target_prompt_key, submitted_by, submitted_at }]`. Without `prompt_key` returns all (used by tree counts).
- New `DELETE /api/admin/ai-insight-feedback/[id]` — hard delete.
- Modified [GET /api/admin/ai-insight-prompts](apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts) — add `feedback_count` per prompt to response (single GROUP BY join).

### UI
**User-side**
- [AiInsightPanel.tsx:228-271](apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx#L228-L271): add **Feedback** button in the footer next to Analyze (all pages, no gating). Plumb `section_key`, `page`, `userName` from `InsightSectionHeader` into the panel via props.
- New: `apps/dashboard/src/components/ai-insight/FeedbackModal.tsx` — uses [dialog.tsx](apps/dashboard/src/components/ui/dialog.tsx); textarea + Save. Mirror [InsightDetailDialog.tsx](apps/dashboard/src/components/ai-insight/InsightDetailDialog.tsx).
- New: `apps/dashboard/src/components/ai-insight/Toast.tsx` — minimal floating banner. Pattern from [PromptEditor.tsx:51,87-106](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx#L51).

**Admin-side**
- [PromptTree.tsx:99-104, 174-181](apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx) — count badge beside the existing `isModified` dot (different color, e.g. blue, with the count).
- [PromptEditor.tsx](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx) — new section under the textarea (~line 227): **Pending feedback** list (compact bullets, raw feedback collapsible, submitted_by/at, **cross** button only — no tick yet). Disabled-looking tick is fine but greyed/hidden until P2.

### Phase 1 Files Summary

**New**
- `migrations/017_ai_insight_feedback.sql`
- `apps/dashboard/src/lib/ai-insight/feedback-llm.ts`
- `apps/dashboard/src/app/api/ai-insight/feedback/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-feedback/route.ts`
- `apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/route.ts`
- `apps/dashboard/src/components/ai-insight/FeedbackModal.tsx`
- `apps/dashboard/src/components/ai-insight/Toast.tsx`
- `apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx`

**Modified**
- [apps/dashboard/src/lib/ai-insight/prompts-defaults.ts](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts) — add `feedback_router_system`
- [apps/dashboard/src/lib/ai-insight/prompt-loader.ts](apps/dashboard/src/lib/ai-insight/prompt-loader.ts) — getter for new system prompt
- [apps/dashboard/src/lib/ai-insight/prompts.ts](apps/dashboard/src/lib/ai-insight/prompts.ts) — register new system key
- [apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts](apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts) — add `feedback_count`
- [apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx](apps/dashboard/src/components/ai-insight/AiInsightPanel.tsx) — Feedback button + props
- [apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx](apps/dashboard/src/components/ai-insight/InsightSectionHeader.tsx) — pass `section_key`/`page`/`userName` through
- [apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx](apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx) — count badge
- [apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx) — feedback list block

### Phase 1 Verification
1. Run migration locally; confirm `ai_insight_feedback` exists.
2. Restart dev server; ensure new system prompt seeded into `ai_insight_prompts`.
3. From dashboard → Payment → Payment Collection Trend panel → click Feedback → submit "Drop the collection-days metric, focus only on the shortfall amount." Confirm toast.
4. DB check: row in `ai_insight_feedback` with non-null `target_prompt_key` and 2–4-bullet `compact_feedback`.
5. Repeat from a Sales section to verify routing across pages.
6. Open `/admin/ai-insight-config` (admin role) → see badge on the routed prompt in tree → click → see feedback under textarea.
7. Click cross → confirm row gone, badge decrements.
8. `tsc --noEmit` in `apps/dashboard`.
9. Per project memory (Playwright verification, no gray/muted text): Playwright pass — no gray/muted text in modal or feedback list (older execs).

### Phase 1 Exit Criteria
- All Phase 1 tracker boxes ticked.
- One Playwright recording showing user submit → admin sees → admin discards.
- Lessons-learned entry written for any router miscategorizations or UI surprises.

---

## Phase 2 — Surgical Edit Apply

### Goal
Admin clicks tick → preview surgical edit → diff modal → confirm → prompt updated with history rotation.

### DB
New file: `migrations/018_prompts_history.sql`
```sql
ALTER TABLE ai_insight_prompts
  ADD COLUMN previous_text   TEXT,
  ADD COLUMN previous_text_2 TEXT;
```

### LLM
- Add `surgical_editor_system` to [prompts-defaults.ts](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts) + seed.
- `proposeSurgicalEdit({ current_prompt_text, compact_feedback })` in `feedback-llm.ts`. Tool `propose_edit`: `{ proposed_text, change_summary }`. Model: `process.env.AI_INSIGHT_SURGICAL_EDITOR_MODEL || 'claude-sonnet-4-6'`.

### API
- `POST /api/admin/ai-insight-feedback/[id]/preview` → loads feedback row + current prompt → calls `proposeSurgicalEdit()` → returns `{ proposed_text, change_summary }`. **No DB write.**
- `POST /api/admin/ai-insight-feedback/[id]/apply` → body `{ proposed_text }` → in a transaction: rotate (`previous_text_2 = previous_text`, `previous_text = prompt_text`, `prompt_text = proposed_text`), delete feedback row.

### UI
- New: `apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx` — left = current, right = proposed (side-by-side or unified diff), header shows `change_summary`, footer Cancel/Confirm.
- [PromptEditor.tsx](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx) feedback list: enable **tick** button → calls `/preview` → opens `DiffModal` → Confirm → calls `/apply` → optimistic UI removal.

### Phase 2 Verification
1. Run migration; confirm columns exist.
2. Submit feedback; admin clicks tick → preview returns proposed text & change summary.
3. Confirm in diff → DB: `prompt_text` = proposed, `previous_text` = old, `previous_text_2` = NULL (first edit), feedback row deleted.
4. Submit another feedback; tick → confirm; verify `previous_text_2` now = the first-prior version.
5. Cancel from diff modal → no DB change, feedback row still pending.
6. `tsc --noEmit`.
7. Playwright: full happy path including diff visibility.

---

## Phase 3 — Polish & History

### Goal
Manual edits and resets also rotate history; admin can revert; both new system prompts are first-class entries in admin UI; sidebar shows total pending count.

### API
- Modify PUT [`/api/admin/ai-insight-prompts/[prompt_key]/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/route.ts) — rotate history on save.
- Modify POST [`.../reset/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/reset/route.ts) — rotate history on reset (so reset is undoable).
- New `POST /api/admin/ai-insight-prompts/[prompt_key]/revert` — body `{ to: 'previous' | 'previous_2' }` → rotate appropriately.

### UI
- New: `apps/dashboard/src/components/admin/ai-insight-config/HistoryDropdown.tsx` — placed in PromptEditor action row (next to Reset). Shows Current / Previous / Previous-2; Revert action per non-current entry; disabled when NULL.
- Confirm both `feedback_router_system` and `surgical_editor_system` are visibly present in `PromptTree` System section — sortable, editable, resettable.
- [AppSidebar.tsx](apps/dashboard/src/components/layout/AppSidebar.tsx): admin-only badge on AI Insight Config link, total pending count from `GET /api/admin/ai-insight-feedback`.

### Phase 3 Verification
1. Manually save a prompt → `previous_text` rotates; check DB.
2. Save again → `previous_text_2` rotates; check DB.
3. Reset to default → rotation also fires; previous text preserved.
4. Revert via dropdown to Previous → confirm rotation reverses correctly.
5. Sidebar badge updates as feedback is added/removed.
6. Edit `feedback_router_system` from admin UI; submit a fresh user feedback; verify edited router prompt is in effect (loader cache 30s; may need wait or restart).
7. `tsc --noEmit`.
8. Playwright on full system.

---

## Reusable Pieces (no need to recreate)

- Dialog primitive: [components/ui/dialog.tsx](apps/dashboard/src/components/ui/dialog.tsx)
- Anthropic client + cost util: [lib/ai-insight/client.ts](apps/dashboard/src/lib/ai-insight/client.ts)
- DB-backed prompt loader (30s cache): [lib/ai-insight/prompt-loader.ts](apps/dashboard/src/lib/ai-insight/prompt-loader.ts)
- Section→component registry: [lib/ai-insight/prompts.ts](apps/dashboard/src/lib/ai-insight/prompts.ts) (`SECTION_COMPONENTS`, `SECTION_PAGE`)
- Role gate: `useRole()` / `isAdmin` from [RoleProvider.tsx](apps/dashboard/src/components/layout/RoleProvider.tsx)
- Existing prompt API patterns under [apps/dashboard/src/app/api/admin/ai-insight-prompts/](apps/dashboard/src/app/api/admin/ai-insight-prompts/)

## Assumptions

- Router LLM is **forced** to pick a component (tool-use enum). Wrong picks → admin discards (P1) or, eventually, manually re-routes (out of scope).
- System prompts (global / summary / new feedback ones) are **not** valid router targets — only component prompts in the user's section.
- Server-side admin role gating on existing prompt routes is **out of scope** (UI gating already in place via `useRole`); flagged as separate cleanup.
- Two-step history is sufficient (per user instruction); no full version-history table.
- 30s prompt-loader cache means prompt edits take effect with up to 30s lag — acceptable for an admin tool.

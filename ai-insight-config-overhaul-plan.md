# AI Insight Config Overhaul — Implementation Plan

> **Author:** Mary (BMad Analyst) · 2026-05-10
> **Implementer:** Amelia (`/bmad-agent-dev`) — one phase per session
> **Working dir:** `/Users/aqreight/Documents/Projects/Hoi-Yong_Finance`

---

## Context

### Why this change
The AI Insight Config admin page has accumulated friction:

1. **Manual prompt editing is dangerous** — admins can free-edit any prompt body, bypassing the structured feedback flow that exists to keep edits intentional and auditable.
2. **History is shallow** — only two snapshots (`previous_text`, `previous_text_2`) survive per prompt; everything older is lost on the third edit.
3. **UI conflates editing and reviewing** — one tall textarea panel mixes prompt body, history, feedback, and reset buttons. Hard to scan, easy to mis-click.
4. **Terminology drift** — the system prompt still talks about a "General" block while the DB and PRD use `section_guidance`. Confuses both LLM (which sees both terms in context) and humans.
5. **Feedback word limit is wrong** — current cap is 2000 chars; the desired UX cap is 80 words.

### Intended outcome
A version-first config page where:
- Every prompt has a non-deletable **Default** version plus a bounded set of feedback-derived versions (cards in a side panel).
- Edits happen **only** through the feedback flow → Apply → new version → auto-select.
- The UI is split into 5 clear sections (Tree, Breadcrumbs, Prompt Text, Version, Feedback).
- Terminology is consistent: **Guidance** everywhere user-facing; `section_guidance` stays as the DB enum (semantic, no migration needed).
- Feedback is capped at 80 words (English only) at both client and server.

---

## Decisions (locked with user)

| # | Decision | Choice |
|---|----------|--------|
| 1 | HR placeholder | Empty DB scaffold under `page='hr'` (rows from HR PRD doc 12, blank `prompt_text`) |
| 2 | Apply flow | Keep preview→confirm: surgical editor LLM proposes against currently selected version, admin confirms, new version inserted |
| 3 | Old `previous_text` data | Discard. Default version = current `prompt_text` on cutover. Drop the two history columns. |
| 4 | Reset buttons | Remove both ("Reset to Default" + "Reset All"). Selecting Default version replaces the first; manual reseeding replaces the second. |
| 5 | Feedback language | English only. Whitespace-split word counting. |

### Mary's defaults (locked unless flagged)

- **Max versions per prompt = 6** (1 Default + 5 feedback-derived). Static cap, fits the right-column UI without scrolling. No runtime measurement.
- **Version label format:** `Default` (immutable) or `${updated_by} · ${date_time}` (e.g., `jdoe · May 10, 10:53 AM`).
- **80-word enforcement:** client-side live counter + disable submit; server-side 400 reject. Word count = whitespace-split tokens, ignore empties.
- **Selected-version storage:** add `selected_version_id` FK on `ai_insight_prompts`. Keep `prompt_text` as a denormalized write-through cache of the selected version's body — `prompt-loader.ts` and `orchestrator.ts` stay a single-row read.
- **Surgical editor reference frame:** edits the **currently selected version's** body (which equals `prompt_text` cache). New version inserted as latest, auto-selected.
- **Version delete fallback:** when the selected version is deleted, auto-select the version immediately above it in the card list (next-newer; falls back to Default if none).
- **HR scaffold scope:** 5 section guidance rows only, no component rows yet. Section keys: `employee_demographics`, `attendance_leave`, `overtime_work_hours`, `payroll_compensation`, `performance_talent`. All bodies empty (`''`). Component prompts come when HR is properly implemented.
- **`compact_feedback` column:** stays. Feedback-llm reads it as surgical-editor input. Today it mirrors `raw_feedback` (no AI rewrite). Dropping it is a separate cleanup, out of scope here.

---

## Phasing overview (4 phases — 1 session each)

| Phase | Theme | Risk | Schema change? |
|-------|-------|------|----------------|
| 1 | Rename "General"→"Guidance" + 80-word feedback cap | Low | None |
| 2 | Versions schema + backend rewire + HR scaffold | High | Yes (new table, drop columns, FK) |
| 3 | UI restructure to 5 sections + version cards | Medium | None |
| 4 | Cleanup + Playwright E2E verification | Low | None |

---

## Phase 1 — Rename "General" → "Guidance" + 80-word feedback limit

**Status:** ☑ Complete (2026-05-10)
**Goal:** Land all string-only changes plus the feedback word-cap. Zero schema work. Re-seed at end so changes hit the running DB.

### Tasks

- [x] **1.1** Rename "General" → "Guidance" in [`apps/dashboard/src/lib/ai-insight/prompts-defaults.ts`](apps/dashboard/src/lib/ai-insight/prompts-defaults.ts) at lines **1024, 1127, 1132, 1134, 1147, 1161, 1163**. Each is a UI-facing string inside system / router / surgical-editor prompts. After editing, search the file for `\bGeneral\b` and `\bgeneral\b` to confirm none missed.
- [x] **1.2** Rename in [`apps/dashboard/src/lib/ai-insight/feedback-llm.ts`](apps/dashboard/src/lib/ai-insight/feedback-llm.ts) at lines **6, 59, 86, 94**. Note line 59 contains `(general)` as a key tag — replace with `(guidance)`. (Also caught a comment on line 55 in same fallback context.)
- [x] **1.3** Rename display label in [`apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts) line **103**: ``— General`` → ``— Guidance``.
- [x] **1.4** Repo-wide grep for any remaining `General` / `general` strings tied to AI Insight UI/prompts. Skip unrelated matches like `general-purpose` agent. Update found instances. Patched `PromptTree.tsx` (210, 213) and `prompts.ts` (199, 204).
- [x] **1.5** Add `countWords(text: string): number` shared helper. Suggested location: [`apps/dashboard/src/lib/ai-insight/word-count.ts`](apps/dashboard/src/lib/ai-insight/word-count.ts). Implementation: `text.trim().split(/\s+/).filter(Boolean).length`. Also exports `FEEDBACK_MAX_WORDS = 80`.
- [x] **1.6** Update [`apps/dashboard/src/components/ai-insight/FeedbackModal.tsx`](apps/dashboard/src/components/ai-insight/FeedbackModal.tsx):
  - Replace `MAX_CHARS = 2000` with `MAX_WORDS = 80`
  - Live word counter: `${wordCount} / 80 words` (color amber-600 when >70, red-600 when >80)
  - Disable submit when `wordCount > 80` or `wordCount === 0`
  - Update placeholder hint to mention 80-word cap
- [x] **1.7** Update [`apps/dashboard/src/app/api/ai-insight/feedback/route.ts`](apps/dashboard/src/app/api/ai-insight/feedback/route.ts): replace `MAX_FEEDBACK_CHARS = 2000` block at lines **21, 46-51** with word check using `countWords`. Return 400 with body `{ error: 'Feedback exceeds 80 words.' }` when over.
- [x] **1.8** Run dev server, hit `/api/admin/ai-insight-prompts/seed-defaults?force=seed` to push prompt body changes into DB (per `feedback_finish_phase_fully.md` memory). Three system prompts (summary_system, feedback_router_system, surgical_editor_system) had `updated_by='prompt-redesign'` from yesterday's session — flipped to `'seed'` so `force=seed` would refresh them; `aging_analysis` and `payment_outstanding_guidance` admin-feedback edits left untouched.

### Verification — Phase 1

- [x] In DB: `SELECT prompt_text FROM ai_insight_prompts WHERE prompt_key='summary_system'` → contains "Guidance" not "General"
- [x] In DB: same check on `feedback_router_system` and `surgical_editor_system`
- [x] In DB: section guidance display names show `— Guidance` suffix (visible via the admin tree)
- [x] AI Insight Panel: 80-word feedback submits OK; 81-word feedback disables submit button
- [x] AI Insight Panel: word counter live-updates as user types, color-shifts at 71+ and 81+
- [x] Direct API call: `POST /api/ai-insight/feedback` with 81-word `raw_feedback` returns 400 with the expected error string
- [x] Smoke test: 80-word feedback POST end-to-end succeeded (router LLM picked `sales_trend_guidance` correctly with the new `(guidance)` tag), confirming the renamed prompts still drive routing.

---

## Phase 2 — Versions schema + backend rewire + HR scaffold

**Status:** ☐ Not started
**Goal:** Replace 2-slot history with a real versions table. Rewire the Apply flow. Remove all manual-edit endpoints. Seed HR scaffold rows. After this phase the runtime still reads from `prompt_text` cache, so summary generation keeps working — only the writes change.

### DB migration — new file [`apps/dashboard/migrations/020_prompt_versions.sql`](apps/dashboard/migrations/020_prompt_versions.sql)

- [ ] **2.1** Create table:
  ```sql
  CREATE TABLE IF NOT EXISTS ai_insight_prompt_versions (
    id SERIAL PRIMARY KEY,
    prompt_key TEXT NOT NULL REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE,
    version_label TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    prompt_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    source_feedback_id INTEGER -- not FK; feedback rows get deleted on apply
  );
  CREATE INDEX idx_prompt_versions_key_created ON ai_insight_prompt_versions(prompt_key, created_at DESC);
  CREATE UNIQUE INDEX idx_prompt_versions_one_default ON ai_insight_prompt_versions(prompt_key) WHERE is_default = TRUE;
  ```
- [ ] **2.2** Add FK column:
  ```sql
  ALTER TABLE ai_insight_prompts
    ADD COLUMN IF NOT EXISTS selected_version_id INTEGER REFERENCES ai_insight_prompt_versions(id) ON DELETE SET NULL;
  ```
- [ ] **2.3** **Backfill** Default version per prompt:
  ```sql
  INSERT INTO ai_insight_prompt_versions (prompt_key, version_label, is_default, prompt_text, created_by)
  SELECT prompt_key, 'Default', TRUE, prompt_text, 'system'
  FROM ai_insight_prompts;
  UPDATE ai_insight_prompts p
    SET selected_version_id = v.id
    FROM ai_insight_prompt_versions v
    WHERE v.prompt_key = p.prompt_key AND v.is_default = TRUE;
  ```
- [ ] **2.4** Drop legacy history columns:
  ```sql
  ALTER TABLE ai_insight_prompts
    DROP COLUMN IF EXISTS previous_text,
    DROP COLUMN IF EXISTS previous_text_2;
  ```

### Backend rewire

- [ ] **2.5** Update [`apps/dashboard/src/lib/ai-insight/prompt-loader.ts`](apps/dashboard/src/lib/ai-insight/prompt-loader.ts):
  - Remove `previous_text`, `previous_text_2` from `PromptRow` interface (lines **28-29**), the SELECT (lines **55-56**), and the camelCase mapping (lines **80-81**).
  - Add `selected_version_id: number | null` to `PromptRow`.
  - Hot path (`getComponentPrompt`, `getSectionGuidance`, etc.) keeps reading `prompt_text` — **no join**.
- [ ] **2.6** Update [`apps/dashboard/src/lib/ai-insight/prompt-store.ts`](apps/dashboard/src/lib/ai-insight/prompt-store.ts):
  - **Remove** `rotateAndWrite` (line ~89), `resetPrompt` (uses rotation), `revertPrompt` (uses rotation).
  - **Add** new functions:
    - `listVersions(promptKey: string)` — returns versions sorted Default-first, then created_at DESC
    - `insertVersionAndSelect({ promptKey, promptText, createdBy, sourceFeedbackId })` — inserts new version row, updates `selected_version_id`, updates `prompt_text` cache, all in one transaction. Throws `VERSION_CAP_REACHED` if count ≥ 6.
    - `selectVersion({ promptKey, versionId })` — sets `selected_version_id`, copies version body into `prompt_text` cache, calls `invalidateCache()`.
    - `deleteVersion({ promptKey, versionId })` — refuses if `is_default`. If was selected, picks fallback (next-newer in created_at order, or Default). Updates cache + `selected_version_id`.
- [ ] **2.7** Update Apply endpoint [`apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/apply/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/apply/route.ts):
  - Replace the `previous_text_2 ← previous_text ← prompt_text` rotation (lines **65-72**) with a call to `insertVersionAndSelect()`.
  - On `VERSION_CAP_REACHED`, return 400 with body `{ error: 'VERSION_CAP_REACHED', message: 'The prompt version section is full. Please clear unwanted versions before proceeding with this action.' }`.
  - Keep: feedback row delete, `invalidateCache()`, transaction wrapping.
- [ ] **2.8** New endpoint `GET /api/admin/ai-insight-prompts/[prompt_key]/versions` — returns `{ versions: VersionRowView[] }` ordered Default-first. `VersionRowView` shape: `{ id, label, isDefault, isSelected, createdAt, createdBy }`. Don't return `promptText` here (saves bytes; UI reads body from selected prompt).
- [ ] **2.9** New endpoint `POST /api/admin/ai-insight-prompts/[prompt_key]/versions/[id]/select` — calls `selectVersion()`. Returns updated `PromptRowView`.
- [ ] **2.10** New endpoint `DELETE /api/admin/ai-insight-prompts/[prompt_key]/versions/[id]`:
  - 400 if `is_default = TRUE`
  - Calls `deleteVersion()`. Returns updated `{ versions, prompt }` so UI can re-render.
- [ ] **2.11** **Remove** these endpoints (manual editing dead):
  - File `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/route.ts` — keep GET, **delete** PUT handler
  - Delete file `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/reset/route.ts`
  - Delete file `apps/dashboard/src/app/api/admin/ai-insight-prompts/reset-all/route.ts`
  - Delete file `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/revert/route.ts`
- [ ] **2.12** Update [`apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts) GET (line ~32):
  - Drop `defaultText` and `isModified` computation.
  - Add `selectedVersionId: number | null`, `selectedVersionLabel: string | null` (the latter requires a join to `ai_insight_prompt_versions`).
- [ ] **2.13** Update single-prompt GET [`apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/route.ts) (line ~24): same shape change.
- [ ] **2.14** Update preview endpoint [`apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/preview/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/preview/route.ts) — confirm it reads `prompt_text` from `ai_insight_prompts` (which equals selected version's body via cache). No structural change needed; verify only.

### HR scaffold

- [ ] **2.15** Update [`apps/dashboard/src/lib/ai-insight/prompts.ts`](apps/dashboard/src/lib/ai-insight/prompts.ts):
  - Add to `SECTION_NAMES`:
    ```ts
    employee_demographics: 'Employee Demographics & Movement',
    attendance_leave: 'Attendance & Leave Monitoring',
    overtime_work_hours: 'Overtime & Work Hours',
    payroll_compensation: 'Payroll & Compensation',
    performance_talent: 'Performance & Talent Management',
    ```
  - Add to `SECTION_PAGE`: each of the 5 keys → `'hr'`
  - Add to `SECTION_COMPONENTS`: each of the 5 keys → `[]` (empty, no component prompts yet)
- [ ] **2.16** Update seed-defaults to seed empty section_guidance rows for each HR section. In [`apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts`](apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts), the existing loop over sections will pick up HR keys automatically — verify the section_guidance row gets `prompt_text = ''` when `DEFAULT_SECTION_GUIDANCE[sectionKey]` is undefined. If not, add empty-string fallback.
- [ ] **2.17** Run migration locally: `psql ... -f apps/dashboard/migrations/020_prompt_versions.sql` (or whatever migration runner this repo uses — check `package.json` scripts).
- [ ] **2.18** Hit `POST /api/admin/ai-insight-prompts/seed-defaults?force=seed` to scaffold HR rows.

### Verification — Phase 2

- [ ] `psql -c "\d ai_insight_prompts"` — confirms `previous_text`, `previous_text_2` columns dropped, `selected_version_id` added
- [ ] `psql -c "\d ai_insight_prompt_versions"` — confirms new table with all expected columns + indexes
- [ ] `SELECT COUNT(*) FROM ai_insight_prompt_versions WHERE is_default = TRUE GROUP BY prompt_key HAVING COUNT(*) != 1` returns zero rows (every prompt has exactly one Default)
- [ ] `SELECT prompt_key FROM ai_insight_prompts WHERE selected_version_id IS NULL` returns zero rows
- [ ] `SELECT prompt_key FROM ai_insight_prompts WHERE page='hr'` returns 5 rows (the HR scaffolds)
- [ ] `curl -X PUT /api/admin/ai-insight-prompts/global_system` → 405 or 404
- [ ] `curl -X POST /api/admin/ai-insight-prompts/global_system/reset` → 404
- [ ] `curl -X POST /api/admin/ai-insight-prompts/reset-all` → 404
- [ ] `curl /api/admin/ai-insight-prompts/global_system/versions` → returns versions array
- [ ] Apply a feedback (via existing Apply endpoint) → new version row inserted, `selected_version_id` updated, `prompt_text` matches new body
- [ ] Manually insert 5 versions for one prompt; attempt Apply → 400 with `VERSION_CAP_REACHED`
- [ ] Select a different version via POST → `prompt_text` cache reflects the change immediately
- [ ] Delete a non-default version → row removed; if was selected, `prompt_text` falls back correctly
- [ ] Delete attempt on Default version → 400
- [ ] Existing summary generation still works on Sales Trend (smoke test)

---

## Phase 3 — UI restructure (5 sections + version cards)

**Status:** ☐ Not started
**Goal:** Land the new layout per the mockup. Tree on left, then a right-side area split into Breadcrumb (top), Prompt Text + Version Panel (middle row), Feedback (bottom). `PromptEditor.tsx` becomes obsolete; its child components (`FeedbackList`, surgical preview/diff flow) are re-parented to the new dashboard.

### Components to add

- [ ] **3.1** New [`apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx`](apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx). Derives crumbs from selected prompt's metadata:
  - System: `System Prompt / ${displayName}`
  - User Guidance: `User Prompt / ${page} / ${sectionGroup} / ${sectionName} / Guidance`
  - User Component: `User Prompt / ${page} / ${sectionGroup} / ${sectionName} / ${componentName}`
  - HR Guidance: `User Prompt / HR / ${sectionName} / Guidance`
  - No vertical scrolling.
- [ ] **3.2** New [`apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx). Read-only display:
  - Renders `prompt.promptText` in a non-editable `<pre>` or `<div>` with `white-space: pre-wrap`.
  - Top-right pill shows selected version label.
  - Vertical scrolling when content overflows.
  - **No textarea, no edit, no save** — this is purely view.
- [ ] **3.3** New [`apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx`](apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx):
  - SWR fetches `/api/admin/ai-insight-prompts/${promptKey}/versions`
  - Renders ≤6 cards stacked vertically; **no scroll**
  - Default card: yellow border + "Default" label, no trash icon
  - Other cards: `${createdBy} · ${formattedDate}` + trash icon button
  - Selected card: blue ring/highlight
  - Click card → POST `/select` → mutate SWR (versions, prompt, prompts list)
  - Click trash → confirm dialog → DELETE `/versions/[id]` → mutate
  - When 6 cards present, render an inline blocking notice with the warning text (used when feedback Apply is attempted)
- [ ] **3.4** Rebuild [`apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx) layout:
  ```
  ┌─ TREE ─┬─ BreadcrumbBar (no scroll) ─────────────────┐
  │        │                                              │
  │ scroll │ ┌─ PromptTextPanel ─┬─ VersionPanel ──┐    │
  │  -y    │ │     scroll-y      │   no scroll     │    │
  │        │ └───────────────────┴─────────────────┘    │
  │        │                                              │
  │        │ ┌─ FeedbackList (scroll-y) ──────────────┐  │
  │        │ └────────────────────────────────────────┘  │
  └────────┴──────────────────────────────────────────────┘
  ```
  Use CSS grid with explicit `grid-template-rows` to keep the version panel at intrinsic content height.

### Components to modify

- [ ] **3.5** Update [`apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx):
  - Remove modified-dot rendering at lines **120, 141, 174, 215, 247** (and any other instances). Confirm with a fresh grep for `bg-amber-500` after editing.
  - Drop `isModified` from local types if still present.
  - HR section now appears automatically because Phase 2 seeded `page='hr'` rows; the existing `groupByPage` logic picks them up. **Verify** by reading the tree component code — if it has a Finance-only fallback, generalize.
  - Keep numbered feedback balloon at all 5 render sites.
- [ ] **3.6** Update [`apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx`](apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx):
  - **Remove** "Show original feedback" toggle (lines **88-99**) and `showRaw` state.
  - Render raw feedback inline (no toggle, always visible).
  - Update Apply error handling: when server returns `VERSION_CAP_REACHED`, surface the warning text (or scroll up to the VersionPanel notice).
  - Verify existing diff modal preview→confirm flow still works (no functional change here).

### Components to delete

- [ ] **3.7** Delete [`apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx) — its rendering responsibilities split between BreadcrumbBar / PromptTextPanel / VersionPanel / FeedbackList.
- [ ] **3.8** Delete [`apps/dashboard/src/components/admin/ai-insight-config/HistoryDropdown.tsx`](apps/dashboard/src/components/admin/ai-insight-config/HistoryDropdown.tsx) — replaced entirely by VersionPanel.
- [ ] **3.9** Keep [`apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx`](apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx) and [`apps/dashboard/src/components/admin/ai-insight-config/prompt-diff.tsx`](apps/dashboard/src/components/admin/ai-insight-config/prompt-diff.tsx) — DiffModal still used by FeedbackList for the Apply preview.

### Verification — Phase 3

- [ ] All 5 sections render at standard viewport (1440×900); no horizontal overflow
- [ ] Sections without scroll: BreadcrumbBar, VersionPanel — verified by inspecting computed CSS or shrinking content
- [ ] Sections with scroll-y: PromptTree, PromptTextPanel, FeedbackList — verified by overflowing content
- [ ] Modified-dot indicators absent everywhere (`grep bg-amber-500` in `PromptTree.tsx` returns no matches)
- [ ] HR top-level node visible in tree; expanding shows 5 section guidance leaves
- [ ] Breadcrumb correct for: System Prompt / Component Analysis · User Prompt / Finance / Sales / Sales Trend / By Customer · User Prompt / HR / Attendance & Leave Monitoring / Guidance
- [ ] Click a VersionPanel card → PromptTextPanel updates body and pill label
- [ ] Default card has no trash; non-default cards do
- [ ] Apply at 6-version cap shows the warning banner; no DB write occurs
- [ ] Selecting a different version then re-running summary on that section uses the new body

---

## Phase 4 — Cleanup + Playwright E2E verification

**Status:** ☐ Not started
**Goal:** Sweep dead code paths, write a comprehensive Playwright spec from scratch (no e2e exists for AI Insight today), run it, hand off.

### Dead code sweep

- [ ] **4.1** Remove env var `NEXT_PUBLIC_AI_INSIGHT_LOCK_SYSTEM_PROMPTS` references (only in [`apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx) lines **78-81** — file already deleted in Phase 3, verify no other files reference it).
- [ ] **4.2** Repo-wide grep for `previous_text`, `previous_text_2`, `previousText`, `previousText2` — should return zero matches outside migration files.
- [ ] **4.3** Repo-wide grep for `isModified`, `is_modified`, `defaultText`, `bg-amber-500` (in AI insight config dir) — should be zero.
- [ ] **4.4** Repo-wide grep for `handleSave`, `dirty`, `setDraft`, `showDefault` in `apps/dashboard/src/components/admin/ai-insight-config/` — should be zero.
- [ ] **4.5** Confirm `compact_feedback` column still in active use (feedback-llm reads it). If decision changes, document — otherwise leave it.

### Playwright E2E test — new file [`apps/dashboard/e2e/ai-insight-config.spec.ts`](apps/dashboard/e2e/ai-insight-config.spec.ts)

> **Test infrastructure note:** Playwright is already configured at [`apps/dashboard/playwright.config.ts`](apps/dashboard/playwright.config.ts). Existing specs in `apps/dashboard/e2e/` (sales-dashboard, customer-table, etc.) show the pattern — match their auth/setup approach. Use `data-testid` attributes liberally; add them to new components in Phase 3 if missing.

#### Test setup

- [ ] **4.6** Configure test fixtures:
  - Reset DB to seeded state before each describe block (or use a separate test DB)
  - Pre-create one feedback row tied to a known prompt (e.g., `payment_collection_trend.kpi`)
  - Authenticate as super admin (mirror existing spec auth pattern)

#### Group A — Phase 1 verification (rename + word limit)

- [ ] **4.7** A1: AI Insight Panel — type 80-word feedback → submit button enabled, submit succeeds
- [ ] **4.8** A2: AI Insight Panel — type 81-word feedback → submit button disabled, counter shows red `81 / 80 words`
- [ ] **4.9** A3: API direct — `POST /api/ai-insight/feedback` with 81-word body returns 400 with the exact error string
- [ ] **4.10** A4: Admin config tree — every leaf labeled "Guidance" (no "General" anywhere visible). Use `expect(page.getByText('General').count()).toBe(0)` scoped to the tree.
- [ ] **4.11** A5: API check — `GET /api/admin/ai-insight-prompts/summary_system` body contains "Guidance" not "General"

#### Group B — Phase 2 verification (versions + backend)

- [ ] **4.12** B1: API `GET /versions` for any prompt → returns at least Default version, ordered correctly
- [ ] **4.13** B2: API `POST /apply` on existing feedback → response 200, then `GET /versions` returns 2 entries (Default + new), new is selected
- [ ] **4.14** B3: API repeat 5× to fill cap → 6th apply returns 400 `VERSION_CAP_REACHED`
- [ ] **4.15** B4: API `DELETE /versions/[id]` on non-default → 200, version count decreases
- [ ] **4.16** B5: API `DELETE /versions/[id]` on Default → 400
- [ ] **4.17** B6: API `POST /versions/[id]/select` on a non-selected version → response 200, prompt_text cache matches that version's body (verify via subsequent GET)
- [ ] **4.18** B7: API removed endpoints — `PUT /[key]`, `POST /[key]/reset`, `POST /reset-all`, `POST /[key]/revert` all return 404 or 405
- [ ] **4.19** B8: HR scaffolds — `GET /api/admin/ai-insight-prompts` includes 5 entries with `page === 'hr'` and empty `promptText`

#### Group C — Phase 3 verification (UI layout)

- [ ] **4.20** C1: Open `/admin/ai-insight-config` — all 5 sections visible (assert each by `data-testid`)
- [ ] **4.21** C2: BreadcrumbBar has `overflow: visible` (no scroll) — assert via computed style
- [ ] **4.22** C3: VersionPanel has `overflow: visible` (no scroll) — same
- [ ] **4.23** C4: PromptTree, PromptTextPanel, FeedbackList all have `overflow-y: auto` — same
- [ ] **4.24** C5: PromptTree shows HR top-level node; click expand → 5 HR sections visible
- [ ] **4.25** C6: PromptTree contains zero `bg-amber-500` (modified-dot) elements at any nesting depth
- [ ] **4.26** C7: Click `Component Analysis` system prompt → breadcrumb reads `System Prompt / Component Analysis`
- [ ] **4.27** C8: Click `Sales Trend / By Customer` component → breadcrumb reads expected user-prompt path
- [ ] **4.28** C9: Click `HR / Attendance & Leave Monitoring / Guidance` → breadcrumb reads expected HR path; PromptTextPanel shows empty/placeholder body
- [ ] **4.29** C10: VersionPanel: Default card has no trash icon; non-default cards have trash icon
- [ ] **4.30** C11: Click a non-selected version card → PromptTextPanel body and version pill update
- [ ] **4.31** C12: Click trash on non-default → confirm dialog → confirm → card disappears, list re-renders

#### Group D — End-to-end happy path (multi-step user journey)

- [ ] **4.32** D1: As regular user, open Sales Trend page → click feedback button → submit 50-word feedback → success toast
- [ ] **4.33** D2: Switch to admin, open `/admin/ai-insight-config` → navigate to the routed prompt → feedback appears in FeedbackList with the raw text inline (no toggle)
- [ ] **4.34** D3: Click Apply → DiffModal opens → click Confirm → modal closes
- [ ] **4.35** D4: VersionPanel now shows 2 cards (Default + new), new is selected, PromptTextPanel shows updated body
- [ ] **4.36** D5: FeedbackList for that prompt is empty
- [ ] **4.37** D6: Trigger summary regen for Sales Trend (UI button or background) → completes; verify body sent to LLM matches new version (mock-able via debug log)
- [ ] **4.38** D7: Click Default version card → PromptTextPanel reverts to Default body
- [ ] **4.39** D8: Click Default again, then click new version, then delete new version → version list back to Default-only, selected = Default

#### Group E — Regression / smoke

- [ ] **4.40** E1: Sidebar "AI Insight Config" link still works
- [ ] **4.41** E2: Other admin pages (Sync, Settings) unchanged — load successfully
- [ ] **4.42** E3: Existing summary generation on a Finance section still produces output
- [ ] **4.43** E4: No console errors during full happy-path traversal
- [ ] **4.44** E5: No 5xx responses in network log during full happy-path traversal

#### Group F — Edge cases

- [ ] **4.45** F1: Open an empty HR prompt — PromptTextPanel renders without crash, shows placeholder text or empty state
- [ ] **4.46** F2: Insert a 10,000-char prompt body via direct DB → PromptTextPanel scrolls correctly, doesn't break layout
- [ ] **4.47** F3: Generate 30 pending feedback rows for one prompt → FeedbackList scrolls, doesn't break layout
- [ ] **4.48** F4: Two browser tabs as admin — apply feedback in tab 1 → tab 2 SWR revalidates and shows new version (or at least doesn't crash on stale state)
- [ ] **4.49** F5: Submit feedback with exactly 80 words → succeeds (boundary)
- [ ] **4.50** F6: Submit feedback with whitespace-only content → submit disabled (zero words)

### Final hand-off

- [ ] **4.51** Run full Playwright suite: `npm run test:e2e -- ai-insight-config.spec.ts` (or whatever the project script is). Zero failures.
- [ ] **4.52** Mark all checkboxes in this plan file's tracker.
- [ ] **4.53** Ask user if they want to commit (per `feedback_commit_after_implementation.md`).

---

## Out of scope (explicitly not in this plan)

- Building real HR prompts (the placeholder rows are scaffolded; the actual prompt bodies are a separate HR-PRD-implementation effort)
- Changing the surgical editor LLM logic itself (only its reference frame moves from `prompt_text` to "selected version's body" — equivalent due to cache)
- Adding inter-version diff UI (e.g., "compare v3 to v5")
- Per-version commenting / changelog
- Multi-tenant / per-user version isolation
- Dropping `compact_feedback` column (it's actively read by feedback-llm.ts)
- CJK language support (English only)

## Risks & watchouts

- **Migration drops two columns** — if any unmerged feature branch references `previous_text` or `previous_text_2`, it breaks. Mitigation: Phase 4 grep step **4.2** catches lingering references.
- **Cache invalidation** — `selected_version_id` change must invalidate prompt-loader's in-memory cache. The existing `invalidateCache()` is called inside `selectVersion()` per task **2.6**.
- **HR scaffold idempotency** — `seed-defaults` must use `INSERT ... ON CONFLICT DO NOTHING` on prompts. Re-runs must not duplicate.
- **Playwright auth pattern** — existing specs likely have a session/cookie setup. Match it; don't invent.
- **`PromptEditor.tsx` imports** — only [`PromptConfigDashboard.tsx`](apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx) line **7** imports it. After Phase 3 deletion, no orphan imports.

---

## Critical file paths reference

| File | Why it matters |
|------|----------------|
| `apps/dashboard/src/components/admin/ai-insight-config/PromptConfigDashboard.tsx` | Top-level dashboard, gets restructured in Phase 3 |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptTree.tsx` | Modified-dot removal (Phase 3); HR shows up automatically once seeded |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptEditor.tsx` | **Deleted** in Phase 3 |
| `apps/dashboard/src/components/admin/ai-insight-config/HistoryDropdown.tsx` | **Deleted** in Phase 3 |
| `apps/dashboard/src/components/admin/ai-insight-config/FeedbackList.tsx` | "Show original" toggle removed; cap-error surfaced |
| `apps/dashboard/src/components/admin/ai-insight-config/DiffModal.tsx` | **Kept** — still used for Apply preview |
| `apps/dashboard/src/components/admin/ai-insight-config/prompt-diff.tsx` | **Kept** — shared utility |
| `apps/dashboard/src/components/admin/ai-insight-config/BreadcrumbBar.tsx` | **New** in Phase 3 |
| `apps/dashboard/src/components/admin/ai-insight-config/PromptTextPanel.tsx` | **New** in Phase 3 |
| `apps/dashboard/src/components/admin/ai-insight-config/VersionPanel.tsx` | **New** in Phase 3 |
| `apps/dashboard/src/components/ai-insight/FeedbackModal.tsx` | 80-word client cap (Phase 1) |
| `apps/dashboard/src/lib/ai-insight/prompts-defaults.ts` | "General"→"Guidance" string updates (Phase 1) |
| `apps/dashboard/src/lib/ai-insight/feedback-llm.ts` | "General"→"Guidance" + tool descriptions (Phase 1) |
| `apps/dashboard/src/lib/ai-insight/prompt-loader.ts` | Drop `previous_text` fields, add `selected_version_id` (Phase 2) |
| `apps/dashboard/src/lib/ai-insight/prompt-store.ts` | Replace `rotateAndWrite`/`resetPrompt`/`revertPrompt` with version functions (Phase 2) |
| `apps/dashboard/src/lib/ai-insight/prompts.ts` | Add HR `SECTION_NAMES`/`SECTION_PAGE`/`SECTION_COMPONENTS` entries (Phase 2) |
| `apps/dashboard/src/lib/ai-insight/word-count.ts` | **New** shared word-counter helper (Phase 1) |
| `apps/dashboard/src/app/api/ai-insight/feedback/route.ts` | 80-word server cap (Phase 1) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/route.ts` | Drop `defaultText`/`isModified`, add version fields (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/route.ts` | Same shape change; **delete PUT** (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/reset/route.ts` | **Deleted** in Phase 2 |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/revert/route.ts` | **Deleted** in Phase 2 |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/reset-all/route.ts` | **Deleted** in Phase 2 |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/versions/route.ts` | **New** GET versions list (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/versions/[id]/select/route.ts` | **New** POST select (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/[prompt_key]/versions/[id]/route.ts` | **New** DELETE version (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-feedback/[id]/apply/route.ts` | Replace history rotation with version insert (Phase 2) |
| `apps/dashboard/src/app/api/admin/ai-insight-prompts/seed-defaults/route.ts` | "General"→"Guidance" label (Phase 1); HR scaffold path (Phase 2) |
| `apps/dashboard/migrations/020_prompt_versions.sql` | **New** migration (Phase 2) |
| `apps/dashboard/e2e/ai-insight-config.spec.ts` | **New** Playwright spec (Phase 4) |
| `HY_HR_Finance_AI_Analysis_Dashboard.md` | HR PRD doc 12 — source of HR section names |

---

## Tracker — at a glance

- [x] **Phase 1** Rename + 80-word limit
- [ ] **Phase 2** Versions schema + backend + HR scaffold
- [ ] **Phase 3** UI restructure + version cards
- [ ] **Phase 4** Cleanup + Playwright E2E

---

## Hand-off prompts for Amelia (`/bmad-agent-dev`)

Each phase is its own session. Open a fresh Claude Code session, invoke `/bmad-agent-dev` to summon Amelia, then paste the matching prompt below. Amelia is expected to read this entire plan file before starting and to tick checkboxes (`[x]`) as she completes each task.

---

### Phase 1 prompt (paste verbatim)

```
You're Amelia. Implement Phase 1 of the AI Insight Config overhaul.

Source of truth: ai-insight-config-overhaul-plan.md (in repo root).

Required steps before you write any code:
1. Read the entire plan file top-to-bottom — it supersedes any prior assumption.
2. Confirm the Tracker shows Phase 1 as the next unchecked phase.
3. Re-read the "Decisions" and "Mary's defaults" sections.

Implementation rules:
- Execute every task under "Phase 1 — Rename + 80-word limit" in order.
- After each task is done, edit the plan file and tick its checkbox: change `[ ]` to `[x]` on that line.
- Do NOT pull in Phase 2/3/4 work even if it looks easy — phases are sequenced for risk reasons.
- If you find a discrepancy between the plan and the codebase, STOP and surface it (per CLAUDE.md: don't assume, surface tradeoffs).

Verification:
- Run every item under "Verification — Phase 1" before declaring done.
- Apply migrations and hit seed endpoints in your local env (don't list as user homework — see memory feedback_finish_phase_fully.md).

When all Phase 1 boxes are ticked and verification passes, ask the user whether to commit (per memory feedback_commit_after_implementation.md). Use the project's commit-message convention (see recent commits via git log).

Do not start Phase 2.
```

---

### Phase 2 prompt (paste verbatim)

```
You're Amelia. Implement Phase 2 of the AI Insight Config overhaul.

Source of truth: ai-insight-config-overhaul-plan.md (in repo root).

Required steps before you write any code:
1. Read the entire plan file top-to-bottom.
2. Confirm Phase 1's checkboxes are all ticked. If they aren't, stop — Phase 2 depends on Phase 1.
3. Re-read "Decisions", "Mary's defaults", and the full Phase 2 task list.
4. Read prompt-store.ts and prompt-loader.ts before touching them — understand the current rotateAndWrite / resetPrompt / revertPrompt flows so your replacement preserves the transactional guarantees.

Implementation rules:
- Execute every task under "Phase 2 — Versions schema + backend rewire + HR scaffold" in order.
- The migration (020_prompt_versions.sql) is high-risk: write it, then dry-run mentally before applying. Backfill (2.3) MUST run before drop (2.4) — do not reorder.
- After each task is done, edit the plan file and tick its checkbox.
- Do not touch UI components yet — Phase 3 owns those.
- Match transaction patterns from the existing apply/route.ts (BEGIN ... COMMIT, error rollback).
- Surface any drift between plan and reality immediately.

Verification:
- Run every item under "Verification — Phase 2".
- Apply migration locally, hit seed-defaults locally — see memory feedback_finish_phase_fully.md.
- Smoke-test summary generation on one Finance section AFTER migration to confirm the cache path still works.

When all Phase 2 boxes are ticked and verification passes, ask the user whether to commit.

Do not start Phase 3.
```

---

### Phase 3 prompt (paste verbatim)

```
You're Amelia. Implement Phase 3 of the AI Insight Config overhaul.

Source of truth: ai-insight-config-overhaul-plan.md (in repo root).

Required steps before you write any code:
1. Read the entire plan file top-to-bottom.
2. Confirm Phases 1 and 2 are fully ticked.
3. Re-read the Phase 3 task list and the layout ASCII diagram in task 3.4 — that's the contract for the new layout.
4. Skim each existing component you're modifying or deleting (PromptConfigDashboard, PromptTree, PromptEditor, FeedbackList, HistoryDropdown) before touching them.

Implementation rules:
- Execute every task under "Phase 3 — UI restructure" in order.
- Add `data-testid` attributes to the new components (BreadcrumbBar, PromptTextPanel, VersionPanel, version cards, default card) — Phase 4 depends on them for Playwright selectors.
- After each task is done, tick the checkbox.
- For the layout, use Tailwind grid utilities; do not introduce new CSS-in-JS or styled-components.
- Use existing UI primitives (Button, Card, etc.) from the project's component library — don't roll your own.
- The yellow Default highlight in VersionPanel should match the mockup's tone — use Tailwind `border-amber-400` or similar; verify against memory feedback_readability_no_gray.md (no gray/muted text — these executives need readable contrast).
- Verify that PromptEditor.tsx is the only file importing the deleted components after deletion.

Verification:
- Run every item under "Verification — Phase 3".
- Use Playwright MCP browser tools to manually walk through the UI on localhost:3000 (per memory feedback_playwright_verification.md). Take screenshots of each of the 5 sections to confirm layout.

When all Phase 3 boxes are ticked and verification passes, ask the user whether to commit.

Do not start Phase 4.
```

---

### Phase 4 prompt (paste verbatim)

```
You're Amelia. Implement Phase 4 of the AI Insight Config overhaul — the final phase.

Source of truth: ai-insight-config-overhaul-plan.md (in repo root).

Required steps before you write any code:
1. Read the entire plan file top-to-bottom.
2. Confirm Phases 1, 2, 3 are fully ticked.
3. Read existing Playwright specs in apps/dashboard/e2e/ to learn the project's auth pattern, fixture setup, and selector conventions.
4. Review apps/dashboard/playwright.config.ts.

Implementation rules:
- Execute every task under "Phase 4 — Cleanup + Playwright E2E" in order.
- Tasks 4.1–4.5 are dead-code grep sweeps — fix anything that turns up.
- Tasks 4.6–4.50 are the Playwright spec at apps/dashboard/e2e/ai-insight-config.spec.ts. Group tests into describe blocks matching Groups A–F.
- Use `data-testid` selectors first; fall back to role/label only when needed.
- Don't take shortcuts on test thoroughness — the user explicitly asked for thorough verification with no assumptions.
- For tests that hit DB state (versions count, HR rows), use direct SQL or API calls in test setup; don't rely on UI to assert backend correctness.
- After each task tick the checkbox.

Verification:
- Run the full Playwright spec: cd apps/dashboard && npx playwright test e2e/ai-insight-config.spec.ts
- Zero failures required. If any test fails, debug and fix the underlying code (not the test) unless the test itself has a bug.

When the full suite passes:
- Tick all remaining checkboxes including the master Tracker at the top of the plan file.
- Ask the user whether to commit the final cleanup + e2e spec.
- Mention the plan is now complete and the overhaul is done.
```

---

## Final notes from Mary

This plan is one tool. Amelia should still surface confusion if the codebase contradicts the plan — fresh eyes catch what static analysis misses. And the user (Aqreight) should feel free to hand-edit checkboxes mid-phase if a task gets retitled or split during implementation.

*Treasure map drawn. Hand it to Amelia and let her dig.* 🗺️

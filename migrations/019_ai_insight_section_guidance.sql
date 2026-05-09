-- 019_ai_insight_section_guidance.sql
-- Adds the 'section_guidance' category to ai_insight_prompts so each section
-- can have a section-level guide prompt (deterministic questions + soft hints)
-- injected into the Summary user message, and so the Feedback Router can target
-- it for section-wide feedback.
--
-- Idempotent: drops and recreates the category CHECK constraint to include
-- the new value. Existing rows keep their category unchanged.

ALTER TABLE ai_insight_prompts
  DROP CONSTRAINT IF EXISTS ai_insight_prompts_category_check;

ALTER TABLE ai_insight_prompts
  ADD CONSTRAINT ai_insight_prompts_category_check
    CHECK (category IN ('system', 'component', 'section_guidance'));

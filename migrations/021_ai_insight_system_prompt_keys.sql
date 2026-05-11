-- 021_ai_insight_system_prompt_keys.sql
-- Renames AI Insight system prompt keys to match the admin UI language:
--   global_system            -> component_analysis
--   summary_system           -> summary_analysis
--   feedback_router_system   -> feedback_router
--   surgical_editor_system   -> surgical_editor
--
-- Also seeds blank HR system placeholders:
--   hr_component_analysis
--   hr_summary_analysis

ALTER TABLE ai_insight_prompt_versions
  DROP CONSTRAINT IF EXISTS ai_insight_prompt_versions_prompt_key_fkey;

ALTER TABLE ai_insight_feedback
  DROP CONSTRAINT IF EXISTS ai_insight_feedback_target_prompt_key_fkey;

DO $$
DECLARE
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT *
    FROM (VALUES
      ('global_system', 'component_analysis', 'Component Analysis', 'finance', 0),
      ('summary_system', 'summary_analysis', 'Summary Analysis', 'finance', 1),
      ('feedback_router_system', 'feedback_router', 'Feedback Router', NULL, 4),
      ('surgical_editor_system', 'surgical_editor', 'Surgical Editor', NULL, 5)
    ) AS t(old_key, new_key, new_display_name, new_page, new_sort_order)
  LOOP
    IF EXISTS (SELECT 1 FROM ai_insight_prompts WHERE prompt_key = pair.old_key)
       AND EXISTS (SELECT 1 FROM ai_insight_prompts WHERE prompt_key = pair.new_key) THEN
      DELETE FROM ai_insight_prompt_versions
       WHERE prompt_key = pair.new_key
         AND is_default = TRUE;

      UPDATE ai_insight_prompt_versions
         SET prompt_key = pair.new_key
       WHERE prompt_key = pair.old_key;

      UPDATE ai_insight_feedback
         SET target_prompt_key = pair.new_key
       WHERE target_prompt_key = pair.old_key;

      UPDATE ai_insight_prompts new_prompt
         SET prompt_text = old_prompt.prompt_text,
             selected_version_id = old_prompt.selected_version_id,
             updated_at = old_prompt.updated_at,
             updated_by = old_prompt.updated_by
        FROM ai_insight_prompts old_prompt
       WHERE new_prompt.prompt_key = pair.new_key
         AND old_prompt.prompt_key = pair.old_key;

      DELETE FROM ai_insight_prompts
       WHERE prompt_key = pair.old_key;
    ELSIF EXISTS (SELECT 1 FROM ai_insight_prompts WHERE prompt_key = pair.old_key) THEN
      UPDATE ai_insight_prompt_versions
         SET prompt_key = pair.new_key
       WHERE prompt_key = pair.old_key;

      UPDATE ai_insight_feedback
         SET target_prompt_key = pair.new_key
       WHERE target_prompt_key = pair.old_key;

      UPDATE ai_insight_prompts
         SET prompt_key = pair.new_key
       WHERE prompt_key = pair.old_key;
    END IF;

    UPDATE ai_insight_prompts
       SET display_name = pair.new_display_name,
           page = pair.new_page,
           sort_order = pair.new_sort_order
     WHERE prompt_key = pair.new_key;
  END LOOP;
END $$;

INSERT INTO ai_insight_prompts
  (prompt_key, prompt_text, category, page, section_key, section_name,
   component_type, display_name, sort_order, updated_at, updated_by)
VALUES
  ('hr_component_analysis', '', 'system', 'hr', NULL, NULL, NULL, 'Component Analysis', 2, NOW(), 'seed'),
  ('hr_summary_analysis', '', 'system', 'hr', NULL, NULL, NULL, 'Summary Analysis', 3, NOW(), 'seed')
ON CONFLICT (prompt_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  page = EXCLUDED.page,
  sort_order = EXCLUDED.sort_order;

INSERT INTO ai_insight_prompt_versions
  (prompt_key, version_label, is_default, prompt_text, created_by)
SELECT p.prompt_key, 'Default', TRUE, p.prompt_text, 'seed'
  FROM ai_insight_prompts p
 WHERE p.prompt_key IN ('hr_component_analysis', 'hr_summary_analysis')
   AND NOT EXISTS (
     SELECT 1
       FROM ai_insight_prompt_versions v
      WHERE v.prompt_key = p.prompt_key
        AND v.is_default = TRUE
   );

UPDATE ai_insight_prompts p
   SET selected_version_id = v.id
  FROM ai_insight_prompt_versions v
 WHERE v.prompt_key = p.prompt_key
   AND v.is_default = TRUE
   AND p.prompt_key IN ('hr_component_analysis', 'hr_summary_analysis')
   AND p.selected_version_id IS NULL;

ALTER TABLE ai_insight_prompt_versions
  ADD CONSTRAINT ai_insight_prompt_versions_prompt_key_fkey
  FOREIGN KEY (prompt_key) REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE;

ALTER TABLE ai_insight_feedback
  ADD CONSTRAINT ai_insight_feedback_target_prompt_key_fkey
  FOREIGN KEY (target_prompt_key) REFERENCES ai_insight_prompts(prompt_key) ON DELETE CASCADE;

-- VendaAI Phase 4: repair the default LLM model on existing databases.
-- The previous default used an invalid model identifier. This migration is idempotent.
ALTER TABLE public.agent_configs
  ALTER COLUMN llm_model SET DEFAULT 'gpt-5.6-luna';

UPDATE public.agent_configs
SET llm_model = 'gpt-5.6-luna'
WHERE llm_model IS NULL OR trim(llm_model) = '' OR llm_model = 'gpt-6-luna';

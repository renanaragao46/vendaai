-- Repair databases that may already have applied the earlier model-default migration.
-- Safe to run repeatedly.
ALTER TABLE public.agent_configs
  ALTER COLUMN llm_model SET DEFAULT 'gpt-6-luna';

UPDATE public.agent_configs
SET llm_model = 'gpt-6-luna'
WHERE llm_model IS NULL
   OR trim(llm_model) = ''
   OR llm_model = 'gpt-5.6-luna';

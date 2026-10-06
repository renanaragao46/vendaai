-- VendaAI Fase 3: AI Sales Engine
-- Applied to the connected Supabase database before this migration was committed.
-- Safe to re-run where IF NOT EXISTS is available; policies are recreated explicitly.

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'SIMULATOR' CHECK (channel IN ('SIMULATOR','WHATSAPP')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED','ARCHIVED')),
  ai_state text NOT NULL DEFAULT 'AI_ACTIVE' CHECK (ai_state IN ('AI_ACTIVE','HUMAN_ACTIVE')),
  sales_stage text NOT NULL DEFAULT 'NEW' CHECK (sales_stage IN ('NEW','QUALIFYING','INTERESTED','PRODUCT_PRESENTED','OBJECTION','NEGOTIATION','CHECKOUT','PURCHASED','POST_SALE','LOST')),
  temperature text NOT NULL DEFAULT 'COLD' CHECK (temperature IN ('COLD','WARM','HOT')),
  summary text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS conversations_org_last_message_idx ON public.conversations(organization_id,last_message_at DESC);
CREATE INDEX IF NOT EXISTS conversations_org_contact_idx ON public.conversations(organization_id,contact_id);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('CUSTOMER','AI','HUMAN','SYSTEM')),
  message_type text NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','AUDIO','IMAGE','DOCUMENT')),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','DELIVERED','READ','ERROR')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_org_conversation_created_idx ON public.messages(organization_id,conversation_id,created_at);

CREATE TABLE IF NOT EXISTS public.customer_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name text,
  preferences text[] NOT NULL DEFAULT '{}',
  products_of_interest jsonb NOT NULL DEFAULT '[]'::jsonb,
  objections text[] NOT NULL DEFAULT '{}',
  purchase_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_interaction_at timestamptz,
  sales_stage text NOT NULL DEFAULT 'NEW' CHECK (sales_stage IN ('NEW','QUALIFYING','INTERESTED','PRODUCT_PRESENTED','OBJECTION','NEGOTIATION','CHECKOUT','PURCHASED','POST_SALE','LOST')),
  temperature text NOT NULL DEFAULT 'COLD' CHECK (temperature IN ('COLD','WARM','HOT')),
  voluntarily_provided jsonb NOT NULL DEFAULT '{}'::jsonb,
  conversation_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,contact_id)
);
CREATE INDEX IF NOT EXISTS customer_memories_org_contact_idx ON public.customer_memories(organization_id,contact_id);

CREATE TABLE IF NOT EXISTS public.sales_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  from_temperature text,
  to_temperature text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_stage_history_org_conversation_idx ON public.sales_stage_history(organization_id,conversation_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  intent text,
  confidence numeric(5,4) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  sales_stage text,
  temperature text,
  action text,
  generated_response text,
  duration_ms integer,
  result text NOT NULL DEFAULT 'PENDING' CHECK (result IN ('SUCCESS','PENDING_CONFIGURATION','VALIDATION_FAILED','HANDOFF','ERROR')),
  error text,
  provider text,
  model text,
  validation jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_runs_org_created_idx ON public.ai_runs(organization_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_org_conversation_idx ON public.ai_runs(organization_id,conversation_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES public.ai_runs(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'SELECTED' CHECK (status IN ('SELECTED','EXECUTED','FAILED')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_actions_org_created_idx ON public.ai_actions(organization_id,created_at DESC);

CREATE TABLE IF NOT EXISTS public.conversation_handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  created_by uuid,
  closed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);
CREATE INDEX IF NOT EXISTS conversation_handoffs_org_status_idx ON public.conversation_handoffs(organization_id,status,created_at DESC);

ALTER TABLE public.agent_configs
  ADD COLUMN IF NOT EXISTS llm_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS llm_model text NOT NULL DEFAULT 'gpt-6-luna';

CREATE OR REPLACE FUNCTION public.record_conversation_stage_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.sales_stage IS DISTINCT FROM NEW.sales_stage OR OLD.temperature IS DISTINCT FROM NEW.temperature THEN
    INSERT INTO public.sales_stage_history(organization_id,conversation_id,from_stage,to_stage,from_temperature,to_temperature,reason)
    VALUES (
      NEW.organization_id, NEW.id,
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.sales_stage END,
      NEW.sales_stage,
      CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.temperature END,
      NEW.temperature,
      CASE WHEN TG_OP='INSERT' THEN 'initial_state' ELSE 'conversation_state_changed' END
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_conversation_stage_history ON public.conversations;
CREATE TRIGGER trg_conversation_stage_history
AFTER INSERT OR UPDATE OF sales_stage,temperature ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.record_conversation_stage_change();

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations','messages','customer_memories','sales_stage_history','ai_runs','ai_actions','conversation_handoffs'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.conversations';
  EXECUTE 'DROP POLICY IF EXISTS "managers write" ON public.conversations';
  EXECUTE 'CREATE POLICY "members read" ON public.conversations FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers write" ON public.conversations FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.customer_memories';
  EXECUTE 'DROP POLICY IF EXISTS "managers write" ON public.customer_memories';
  EXECUTE 'CREATE POLICY "members read" ON public.customer_memories FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers write" ON public.customer_memories FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.ai_runs';
  EXECUTE 'DROP POLICY IF EXISTS "managers write" ON public.ai_runs';
  EXECUTE 'CREATE POLICY "members read" ON public.ai_runs FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers write" ON public.ai_runs FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.ai_actions';
  EXECUTE 'DROP POLICY IF EXISTS "managers write" ON public.ai_actions';
  EXECUTE 'CREATE POLICY "members read" ON public.ai_actions FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers write" ON public.ai_actions FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.conversation_handoffs';
  EXECUTE 'DROP POLICY IF EXISTS "managers write" ON public.conversation_handoffs';
  EXECUTE 'CREATE POLICY "members read" ON public.conversation_handoffs FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers write" ON public.conversation_handoffs FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';

  EXECUTE 'DROP POLICY IF EXISTS "members read" ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS "members insert" ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS "members update" ON public.messages';
  EXECUTE 'DROP POLICY IF EXISTS "managers delete" ON public.messages';
  EXECUTE 'CREATE POLICY "members read" ON public.messages FOR SELECT TO authenticated USING (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "members insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "members update" ON public.messages FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))';
  EXECUTE 'CREATE POLICY "managers delete" ON public.messages FOR DELETE TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))';
END $$;

DROP TRIGGER IF EXISTS trg_sales_stage_history_updated ON public.sales_stage_history;
DROP TRIGGER IF EXISTS trg_ai_runs_updated ON public.ai_runs;
DROP TRIGGER IF EXISTS trg_ai_actions_updated ON public.ai_actions;
DROP TRIGGER IF EXISTS trg_conversation_handoffs_updated ON public.conversation_handoffs;

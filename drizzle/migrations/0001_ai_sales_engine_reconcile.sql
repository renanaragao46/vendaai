-- VendaAI Phase 3 reconciliation.
-- Safe on both a fresh database and the already-provisioned Lovable Cloud database.
ALTER TABLE public.agent_configs
  ADD COLUMN IF NOT EXISTS llm_provider text NOT NULL DEFAULT 'openai',
  ADD COLUMN IF NOT EXISTS llm_model text NOT NULL DEFAULT 'gpt-6-luna';

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
CREATE INDEX IF NOT EXISTS conversations_org_contact_idx ON public.conversations(organization_id, contact_id);
CREATE INDEX IF NOT EXISTS conversations_org_last_message_idx ON public.conversations(organization_id, last_message_at);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('CUSTOMER','AI','HUMAN','SYSTEM')),
  message_type text NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','AUDIO','IMAGE','DOCUMENT')),
  content text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT','DELIVERED','READ','ERROR')),
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_org_conversation_created_idx ON public.messages(organization_id, conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.customer_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  name text,
  preferences text[] NOT NULL DEFAULT '{}',
  products_of_interest jsonb NOT NULL DEFAULT '[]',
  objections text[] NOT NULL DEFAULT '{}',
  purchase_history jsonb NOT NULL DEFAULT '[]',
  last_interaction_at timestamptz,
  sales_stage text NOT NULL DEFAULT 'NEW',
  temperature text NOT NULL DEFAULT 'COLD',
  voluntarily_provided jsonb NOT NULL DEFAULT '{}',
  conversation_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, contact_id),
  CHECK (sales_stage IN ('NEW','QUALIFYING','INTERESTED','PRODUCT_PRESENTED','OBJECTION','NEGOTIATION','CHECKOUT','PURCHASED','POST_SALE','LOST')),
  CHECK (temperature IN ('COLD','WARM','HOT'))
);
CREATE INDEX IF NOT EXISTS customer_memories_org_contact_idx ON public.customer_memories(organization_id, contact_id);

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
CREATE INDEX IF NOT EXISTS sales_stage_history_org_conversation_idx ON public.sales_stage_history(organization_id, conversation_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  intent text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  sales_stage text,
  temperature text,
  action text,
  generated_response text,
  duration_ms integer,
  result text NOT NULL DEFAULT 'PENDING' CHECK (result IN ('SUCCESS','PENDING_CONFIGURATION','VALIDATION_FAILED','HANDOFF','ERROR')),
  error text,
  provider text,
  model text,
  validation jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_runs_org_conversation_idx ON public.ai_runs(organization_id, conversation_id);
CREATE INDEX IF NOT EXISTS ai_runs_org_created_idx ON public.ai_runs(organization_id, created_at);

CREATE TABLE IF NOT EXISTS public.ai_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ai_run_id uuid REFERENCES public.ai_runs(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.conversations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  status text NOT NULL DEFAULT 'SELECTED' CHECK (status IN ('SELECTED','EXECUTED','FAILED')),
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_actions_org_created_idx ON public.ai_actions(organization_id, created_at);

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
CREATE INDEX IF NOT EXISTS conversation_handoffs_org_status_idx ON public.conversation_handoffs(organization_id, status);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['conversations','messages','customer_memories','sales_stage_history','ai_runs','ai_actions','conversation_handoffs'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY['conversations','ai_runs','ai_actions','conversation_handoffs','customer_memories'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='members read') THEN
      EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='managers write') THEN
      EXECUTE format('CREATE POLICY "managers write" ON public.%I FOR ALL TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))', t);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY ARRAY['messages','sales_stage_history'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='members read') THEN
      EXECUTE format('CREATE POLICY "members read" ON public.%I FOR SELECT TO authenticated USING (public.is_org_member(organization_id))', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='members insert') THEN
      EXECUTE format('CREATE POLICY "members insert" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id))', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='members update') THEN
      EXECUTE format('CREATE POLICY "members update" ON public.%I FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id))', t);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname='managers delete') THEN
      EXECUTE format('CREATE POLICY "managers delete" ON public.%I FOR DELETE TO authenticated USING (public.has_org_role(organization_id, ARRAY[''OWNER'',''ADMIN'',''MANAGER'']::public.app_role[]))', t);
    END IF;
  END LOOP;
END $$;

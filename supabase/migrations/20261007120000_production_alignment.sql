-- Production alignment for the VendaAI database.
-- This migration reconciles the connected Supabase schema with the application
-- code and the historical drizzle migrations. It is intentionally idempotent.

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'META_CLOUD_API' CHECK (provider IN ('META_CLOUD_API')),
  status text NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN ('NOT_CONNECTED','PENDING','CONNECTED','ERROR','DISCONNECTED')),
  display_name text, phone_number text, business_account_id text, phone_number_id text,
  webhook_verified_at timestamptz, connected_at timestamptz, last_error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_accounts_org_idx ON public.whatsapp_accounts(organization_id);
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'META_CLOUD_API', event_key text NOT NULL, event_type text,
  payload jsonb NOT NULL DEFAULT '{}', status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  error text, received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz, UNIQUE(provider,event_key)
);
CREATE INDEX IF NOT EXISTS webhook_events_org_received_idx ON public.webhook_events(organization_id,received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx ON public.webhook_events(status,received_at DESC);
ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_accounts' AND policyname='members read') THEN CREATE POLICY "members read" ON public.whatsapp_accounts FOR SELECT TO authenticated USING (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_accounts' AND policyname='admins write') THEN CREATE POLICY "admins write" ON public.whatsapp_accounts FOR ALL TO authenticated USING (public.has_org_role(organization_id,ARRAY['OWNER','ADMIN']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id,ARRAY['OWNER','ADMIN']::public.app_role[])); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_events' AND policyname='managers read') THEN CREATE POLICY "managers read" ON public.webhook_events FOR SELECT TO authenticated USING (organization_id IS NOT NULL AND public.has_org_role(organization_id,ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[])); END IF;
END $$;
DROP TRIGGER IF EXISTS trg_whatsapp_accounts_updated ON public.whatsapp_accounts;
CREATE TRIGGER trg_whatsapp_accounts_updated BEFORE UPDATE ON public.whatsapp_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.message_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
 message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE, storage_path text, external_media_id text,
 mime_type text, file_name text, file_size bigint, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_attachments_org_message_idx ON public.message_attachments(organization_id,message_id);
CREATE INDEX IF NOT EXISTS message_attachments_external_media_idx ON public.message_attachments(external_media_id);
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='members read') THEN CREATE POLICY "members read" ON public.message_attachments FOR SELECT TO authenticated USING (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='members insert') THEN CREATE POLICY "members insert" ON public.message_attachments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='managers update') THEN CREATE POLICY "managers update" ON public.message_attachments FOR UPDATE TO authenticated USING (public.has_org_role(organization_id,ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id,ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[])); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='managers delete') THEN CREATE POLICY "managers delete" ON public.message_attachments FOR DELETE TO authenticated USING (public.has_org_role(organization_id,ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[])); END IF;
END $$;

ALTER TABLE public.agent_configs ALTER COLUMN llm_model SET DEFAULT 'gpt-6-luna';
UPDATE public.agent_configs SET llm_model='gpt-6-luna' WHERE llm_model IS NULL OR trim(llm_model)='' OR llm_model='gpt-5.6-luna';

DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='members insert') THEN CREATE POLICY "members insert" ON public.conversations FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversations' AND policyname='members update') THEN CREATE POLICY "members update" ON public.conversations FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversation_handoffs' AND policyname='members update') THEN CREATE POLICY "members update" ON public.conversation_handoffs FOR UPDATE TO authenticated USING (public.is_org_member(organization_id)) WITH CHECK (public.is_org_member(organization_id)); END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='conversation_handoffs' AND policyname='members insert') THEN CREATE POLICY "members insert" ON public.conversation_handoffs FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id)); END IF;
END $$;

ALTER TABLE public.webhook_events DROP CONSTRAINT IF EXISTS webhook_events_status_check;
ALTER TABLE public.webhook_events ADD CONSTRAINT webhook_events_status_check CHECK (status IN ('RECEIVED','PROCESSING','PROCESSED','IGNORED','ERROR'));
CREATE UNIQUE INDEX IF NOT EXISTS message_attachments_org_external_media_uidx ON public.message_attachments(organization_id,external_media_id) WHERE external_media_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_number_id_uidx ON public.whatsapp_accounts(phone_number_id) WHERE phone_number_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_phone_uidx ON public.contacts(organization_id,phone) WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_organization_change() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN IF TG_OP='UPDATE' AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN RAISE EXCEPTION 'organization_id is immutable'; END IF; RETURN NEW; END; $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['product_categories','products','knowledge_items','agent_configs','contacts','pipeline_stages','leads','tags','lead_tags','orders','order_items','payments','conversations','messages','customer_memories','sales_stage_history','ai_runs','ai_actions','conversation_handoffs','whatsapp_accounts','message_attachments'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_org_immutable ON public.%I',t,t);
  EXECUTE format('CREATE TRIGGER trg_%s_org_immutable BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_organization_change()',t,t);
 END LOOP;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS conversation_handoffs_one_open_uidx ON public.conversation_handoffs(organization_id,conversation_id) WHERE status='OPEN';
CREATE OR REPLACE FUNCTION public.validate_tenant_references() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE i integer; ref_table text; ref_column text; ref_org uuid; ref_id uuid;
BEGIN
 IF NEW.organization_id IS NULL THEN RETURN NEW; END IF;
 IF TG_NARGS % 2 <> 0 THEN RAISE EXCEPTION 'Invalid tenant reference trigger configuration'; END IF;
 i:=0; WHILE i<TG_NARGS LOOP
  ref_table:=TG_ARGV[i]; ref_column:=TG_ARGV[i+1]; ref_id:=(to_jsonb(NEW)->>ref_column)::uuid;
  IF ref_id IS NULL THEN i:=i+2; CONTINUE; END IF;
  EXECUTE format('SELECT organization_id FROM public.%I WHERE id=$1',ref_table) INTO ref_org USING ref_id;
  IF ref_org IS DISTINCT FROM NEW.organization_id THEN RAISE EXCEPTION 'Cross-organization reference is not allowed: %.% = %',ref_table,ref_column,ref_id; END IF;
  i:=i+2;
 END LOOP; RETURN NEW;
END; $$;
DO $$ BEGIN
 DROP TRIGGER IF EXISTS trg_leads_tenant_refs ON public.leads; CREATE TRIGGER trg_leads_tenant_refs BEFORE INSERT OR UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id','pipeline_stages','stage_id','products','product_id');
 DROP TRIGGER IF EXISTS trg_lead_tags_tenant_refs ON public.lead_tags; CREATE TRIGGER trg_lead_tags_tenant_refs BEFORE INSERT OR UPDATE ON public.lead_tags FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('leads','lead_id','tags','tag_id');
 DROP TRIGGER IF EXISTS trg_orders_tenant_refs ON public.orders; CREATE TRIGGER trg_orders_tenant_refs BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id','leads','lead_id');
 DROP TRIGGER IF EXISTS trg_order_items_tenant_refs ON public.order_items; CREATE TRIGGER trg_order_items_tenant_refs BEFORE INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('orders','order_id','products','product_id');
 DROP TRIGGER IF EXISTS trg_payments_tenant_refs ON public.payments; CREATE TRIGGER trg_payments_tenant_refs BEFORE INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('orders','order_id');
 DROP TRIGGER IF EXISTS trg_conversations_tenant_refs ON public.conversations; CREATE TRIGGER trg_conversations_tenant_refs BEFORE INSERT OR UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id');
 DROP TRIGGER IF EXISTS trg_messages_tenant_refs ON public.messages; CREATE TRIGGER trg_messages_tenant_refs BEFORE INSERT OR UPDATE ON public.messages FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');
 DROP TRIGGER IF EXISTS trg_customer_memories_tenant_refs ON public.customer_memories; CREATE TRIGGER trg_customer_memories_tenant_refs BEFORE INSERT OR UPDATE ON public.customer_memories FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id');
 DROP TRIGGER IF EXISTS trg_sales_stage_history_tenant_refs ON public.sales_stage_history; CREATE TRIGGER trg_sales_stage_history_tenant_refs BEFORE INSERT OR UPDATE ON public.sales_stage_history FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');
 DROP TRIGGER IF EXISTS trg_ai_runs_tenant_refs ON public.ai_runs; CREATE TRIGGER trg_ai_runs_tenant_refs BEFORE INSERT OR UPDATE ON public.ai_runs FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id','messages','message_id');
 DROP TRIGGER IF EXISTS trg_ai_actions_tenant_refs ON public.ai_actions; CREATE TRIGGER trg_ai_actions_tenant_refs BEFORE INSERT OR UPDATE ON public.ai_actions FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('ai_runs','ai_run_id','conversations','conversation_id');
 DROP TRIGGER IF EXISTS trg_conversation_handoffs_tenant_refs ON public.conversation_handoffs; CREATE TRIGGER trg_conversation_handoffs_tenant_refs BEFORE INSERT OR UPDATE ON public.conversation_handoffs FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');
 DROP TRIGGER IF EXISTS trg_message_attachments_tenant_refs ON public.message_attachments; CREATE TRIGGER trg_message_attachments_tenant_refs BEFORE INSERT OR UPDATE ON public.message_attachments FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('messages','message_id');
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_message_uidx ON public.messages(organization_id,conversation_id,sender_type,((metadata->>'external_message_id'))) WHERE metadata ? 'external_message_id' AND nullif(metadata->>'external_message_id','') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS conversations_whatsapp_open_contact_uidx ON public.conversations(organization_id,contact_id) WHERE channel='WHATSAPP' AND status='OPEN' AND contact_id IS NOT NULL;
REVOKE INSERT,DELETE ON public.organizations FROM authenticated;
DROP POLICY IF EXISTS "owner manages memberships" ON public.memberships;
CREATE POLICY "owner manages memberships" ON public.memberships FOR ALL TO authenticated USING (public.has_org_role(organization_id,ARRAY['OWNER']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id,ARRAY['OWNER']::public.app_role[]));

-- Multi-provider WhatsApp support.
ALTER TABLE public.whatsapp_accounts
  DROP CONSTRAINT IF EXISTS whatsapp_accounts_provider_check;
ALTER TABLE public.whatsapp_accounts
  ADD CONSTRAINT whatsapp_accounts_provider_check
  CHECK (provider IN ('META_CLOUD_API','WHATSAPP_WEB'));
ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS gateway_instance_id text,
  ADD COLUMN IF NOT EXISTS gateway_status text,
  ADD COLUMN IF NOT EXISTS provider_config jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_gateway_instance_idx
  ON public.whatsapp_accounts(gateway_instance_id)
  WHERE gateway_instance_id IS NOT NULL;

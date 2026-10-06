-- Enforce tenant consistency across foreign-key relationships.
-- RLS protects row visibility, while these triggers prevent a row from
-- referencing a record owned by another organization.

CREATE OR REPLACE FUNCTION public.validate_tenant_references()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  i integer;
  ref_table text;
  ref_column text;
  ref_org uuid;
  ref_id uuid;
BEGIN
  IF NEW.organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_NARGS % 2 <> 0 THEN
    RAISE EXCEPTION 'Invalid tenant reference trigger configuration';
  END IF;

  i := 0;
  WHILE i < TG_NARGS LOOP
    ref_table := TG_ARGV[i];
    ref_column := TG_ARGV[i + 1];
    EXECUTE format('SELECT organization_id FROM public.%I WHERE id = $1', ref_table)
      INTO ref_org
      USING (to_jsonb(NEW)->>ref_column)::uuid;

    IF ref_org IS DISTINCT FROM NEW.organization_id THEN
      ref_id := (to_jsonb(NEW)->>ref_column)::uuid;
      RAISE EXCEPTION 'Cross-organization reference is not allowed: %.% = %', ref_table, ref_column, ref_id;
    END IF;

    i := i + 2;
  END LOOP;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS trg_leads_tenant_refs ON public.leads;
  CREATE TRIGGER trg_leads_tenant_refs
    BEFORE INSERT OR UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id','pipeline_stages','stage_id','products','product_id');

  DROP TRIGGER IF EXISTS trg_lead_tags_tenant_refs ON public.lead_tags;
  CREATE TRIGGER trg_lead_tags_tenant_refs
    BEFORE INSERT OR UPDATE ON public.lead_tags
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('leads','lead_id','tags','tag_id');

  DROP TRIGGER IF EXISTS trg_orders_tenant_refs ON public.orders;
  CREATE TRIGGER trg_orders_tenant_refs
    BEFORE INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id','leads','lead_id');

  DROP TRIGGER IF EXISTS trg_order_items_tenant_refs ON public.order_items;
  CREATE TRIGGER trg_order_items_tenant_refs
    BEFORE INSERT OR UPDATE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('orders','order_id','products','product_id');

  DROP TRIGGER IF EXISTS trg_payments_tenant_refs ON public.payments;
  CREATE TRIGGER trg_payments_tenant_refs
    BEFORE INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('orders','order_id');

  DROP TRIGGER IF EXISTS trg_conversations_tenant_refs ON public.conversations;
  CREATE TRIGGER trg_conversations_tenant_refs
    BEFORE INSERT OR UPDATE ON public.conversations
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id');

  DROP TRIGGER IF EXISTS trg_messages_tenant_refs ON public.messages;
  CREATE TRIGGER trg_messages_tenant_refs
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');

  DROP TRIGGER IF EXISTS trg_customer_memories_tenant_refs ON public.customer_memories;
  CREATE TRIGGER trg_customer_memories_tenant_refs
    BEFORE INSERT OR UPDATE ON public.customer_memories
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('contacts','contact_id');

  DROP TRIGGER IF EXISTS trg_sales_stage_history_tenant_refs ON public.sales_stage_history;
  CREATE TRIGGER trg_sales_stage_history_tenant_refs
    BEFORE INSERT OR UPDATE ON public.sales_stage_history
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');

  DROP TRIGGER IF EXISTS trg_ai_runs_tenant_refs ON public.ai_runs;
  CREATE TRIGGER trg_ai_runs_tenant_refs
    BEFORE INSERT OR UPDATE ON public.ai_runs
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id','messages','message_id');

  DROP TRIGGER IF EXISTS trg_ai_actions_tenant_refs ON public.ai_actions;
  CREATE TRIGGER trg_ai_actions_tenant_refs
    BEFORE INSERT OR UPDATE ON public.ai_actions
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('ai_runs','ai_run_id','conversations','conversation_id');

  DROP TRIGGER IF EXISTS trg_conversation_handoffs_tenant_refs ON public.conversation_handoffs;
  CREATE TRIGGER trg_conversation_handoffs_tenant_refs
    BEFORE INSERT OR UPDATE ON public.conversation_handoffs
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('conversations','conversation_id');

  DROP TRIGGER IF EXISTS trg_message_attachments_tenant_refs ON public.message_attachments;
  CREATE TRIGGER trg_message_attachments_tenant_refs
    BEFORE INSERT OR UPDATE ON public.message_attachments
    FOR EACH ROW EXECUTE FUNCTION public.validate_tenant_references('messages','message_id');
END $$;

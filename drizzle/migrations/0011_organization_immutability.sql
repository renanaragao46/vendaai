-- Prevent tenant-bound rows from being reassigned to another organization.
-- This complements RLS USING/WITH CHECK policies: membership proves access to both
-- organizations, but a row's tenant ownership must remain immutable.
CREATE OR REPLACE FUNCTION public.prevent_organization_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'product_categories',
    'products',
    'knowledge_items',
    'agent_configs',
    'contacts',
    'pipeline_stages',
    'leads',
    'tags',
    'lead_tags',
    'orders',
    'order_items',
    'payments',
    'conversations',
    'messages',
    'customer_memories',
    'sales_stage_history',
    'ai_runs',
    'ai_actions',
    'conversation_handoffs',
    'whatsapp_accounts',
    'webhook_events',
    'message_attachments'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_org_immutable ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_org_immutable BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_organization_change()',
      t, t
    );
  END LOOP;
END $$;

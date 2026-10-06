-- VendaAI WhatsApp integration foundation.
-- Stores connection metadata only. Access tokens/secrets must remain in server-side secrets.

CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'META_CLOUD_API' CHECK (provider IN ('META_CLOUD_API')),
  status text NOT NULL DEFAULT 'NOT_CONNECTED' CHECK (status IN ('NOT_CONNECTED','PENDING','CONNECTED','ERROR','DISCONNECTED')),
  display_name text,
  phone_number text,
  business_account_id text,
  phone_number_id text,
  webhook_verified_at timestamptz,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_accounts_org_idx ON public.whatsapp_accounts(organization_id);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'META_CLOUD_API',
  event_key text NOT NULL,
  event_type text,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED','PROCESSED','IGNORED','ERROR')),
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider, event_key)
);

CREATE INDEX IF NOT EXISTS webhook_events_org_received_idx ON public.webhook_events(organization_id, received_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_status_idx ON public.webhook_events(status, received_at DESC);

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_accounts TO authenticated;
GRANT ALL ON public.whatsapp_accounts TO service_role;
GRANT SELECT ON public.webhook_events TO authenticated;
GRANT ALL ON public.webhook_events TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_accounts' AND policyname='members read') THEN
    CREATE POLICY "members read" ON public.whatsapp_accounts
      FOR SELECT TO authenticated
      USING (public.is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='whatsapp_accounts' AND policyname='admins write') THEN
    CREATE POLICY "admins write" ON public.whatsapp_accounts
      FOR ALL TO authenticated
      USING (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN']::public.app_role[]))
      WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN']::public.app_role[]));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='webhook_events' AND policyname='managers read') THEN
    CREATE POLICY "managers read" ON public.webhook_events
      FOR SELECT TO authenticated
      USING (organization_id IS NOT NULL AND public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[]));
  END IF;
END $$;

DROP TRIGGER IF EXISTS trg_whatsapp_accounts_updated ON public.whatsapp_accounts;
CREATE TRIGGER trg_whatsapp_accounts_updated
BEFORE UPDATE ON public.whatsapp_accounts
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

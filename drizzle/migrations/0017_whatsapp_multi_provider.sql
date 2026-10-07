-- Expand WhatsApp integrations to support official Meta Cloud API and an optional self-hosted WhatsApp Web gateway.
-- Gateway credentials/sessions never live in the database.

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

COMMENT ON COLUMN public.whatsapp_accounts.provider IS
  'META_CLOUD_API for official Meta integration; WHATSAPP_WEB for the optional self-hosted WhatsApp Web gateway.';

COMMENT ON COLUMN public.whatsapp_accounts.gateway_instance_id IS
  'Opaque instance identifier used by the self-hosted WhatsApp Web gateway. It is not a credential.';

COMMENT ON COLUMN public.whatsapp_accounts.provider_config IS
  'Non-secret provider configuration only. Never store access tokens, cookies, QR sessions, or private keys here.';

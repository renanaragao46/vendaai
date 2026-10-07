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

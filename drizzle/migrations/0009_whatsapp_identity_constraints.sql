-- Enforce one WhatsApp phone-number identity per connected account and
-- one contact per phone number inside each organization.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_accounts_phone_number_id_uidx
  ON public.whatsapp_accounts (phone_number_id)
  WHERE phone_number_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_phone_uidx
  ON public.contacts (organization_id, phone)
  WHERE phone IS NOT NULL;

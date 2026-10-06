-- A WhatsApp contact has one active conversation per organization.
-- This prevents concurrent webhook deliveries from creating parallel open threads.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_whatsapp_open_contact_uidx
  ON public.conversations (organization_id, contact_id)
  WHERE channel = 'WHATSAPP'
    AND status = 'OPEN'
    AND contact_id IS NOT NULL;

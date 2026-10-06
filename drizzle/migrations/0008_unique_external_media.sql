-- Prevent duplicate attachment rows when WhatsApp retries the same media event.
CREATE UNIQUE INDEX IF NOT EXISTS message_attachments_org_external_media_uidx
  ON public.message_attachments (organization_id, external_media_id)
  WHERE external_media_id IS NOT NULL;

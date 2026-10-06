-- Prevent duplicate processing of the same provider message under concurrent webhook delivery.
-- The sender type is included so the inbound CUSTOMER record and outbound AI
-- response may legitimately share the same external provider event id.
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_message_uidx
  ON public.messages (
    organization_id,
    conversation_id,
    sender_type,
    ((metadata->>'external_message_id'))
  )
  WHERE metadata ? 'external_message_id'
    AND nullif(metadata->>'external_message_id','') IS NOT NULL;

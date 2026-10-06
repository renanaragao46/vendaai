-- Ensure each conversation has at most one active human handoff.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_handoffs_one_open_uidx
  ON public.conversation_handoffs (organization_id, conversation_id)
  WHERE status = 'OPEN';

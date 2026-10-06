-- Prevent concurrent webhook deliveries from processing the same event twice.
ALTER TABLE public.webhook_events
  DROP CONSTRAINT IF EXISTS webhook_events_status_check;

ALTER TABLE public.webhook_events
  ADD CONSTRAINT webhook_events_status_check
  CHECK (status IN ('RECEIVED','PROCESSING','PROCESSED','IGNORED','ERROR'));

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path text,
  external_media_id text,
  mime_type text,
  file_name text,
  file_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS message_attachments_org_message_idx ON public.message_attachments(organization_id, message_id);
CREATE INDEX IF NOT EXISTS message_attachments_external_media_idx ON public.message_attachments(external_media_id);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_attachments TO authenticated;
GRANT ALL ON public.message_attachments TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='members read') THEN
    CREATE POLICY "members read" ON public.message_attachments FOR SELECT TO authenticated USING (public.is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='members insert') THEN
    CREATE POLICY "members insert" ON public.message_attachments FOR INSERT TO authenticated WITH CHECK (public.is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='managers update') THEN
    CREATE POLICY "managers update" ON public.message_attachments FOR UPDATE TO authenticated USING (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[])) WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[]));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='message_attachments' AND policyname='managers delete') THEN
    CREATE POLICY "managers delete" ON public.message_attachments FOR DELETE TO authenticated USING (public.has_org_role(organization_id, ARRAY['OWNER','ADMIN','MANAGER']::public.app_role[]));
  END IF;
END $$;
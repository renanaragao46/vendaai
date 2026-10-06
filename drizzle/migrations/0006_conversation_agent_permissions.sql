-- Allow organization members with the AGENT role to work conversations and handoffs.
-- Configuration, AI execution logs and customer memory remain manager-controlled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations' AND policyname='members insert'
  ) THEN
    CREATE POLICY "members insert" ON public.conversations
      FOR INSERT TO authenticated
      WITH CHECK (public.is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversations' AND policyname='members update'
  ) THEN
    CREATE POLICY "members update" ON public.conversations
      FOR UPDATE TO authenticated
      USING (public.is_org_member(organization_id))
      WITH CHECK (public.is_org_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_handoffs' AND policyname='members update'
  ) THEN
    CREATE POLICY "members update" ON public.conversation_handoffs
      FOR UPDATE TO authenticated
      USING (public.is_org_member(organization_id))
      WITH CHECK (public.is_org_member(organization_id));
  END IF;
END $$;

-- Agents need to create handoff records when they manually assume a conversation.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='conversation_handoffs' AND policyname='members insert'
  ) THEN
    CREATE POLICY "members insert" ON public.conversation_handoffs
      FOR INSERT TO authenticated
      WITH CHECK (public.is_org_member(organization_id));
  END IF;
END $$;

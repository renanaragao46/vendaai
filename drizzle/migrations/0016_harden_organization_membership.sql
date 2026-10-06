-- Harden organization creation and membership administration.
-- Only the bootstrap RPC can create organizations; OWNER remains the only role
-- allowed to administer memberships.

REVOKE INSERT, DELETE ON public.organizations FROM authenticated;

DROP POLICY IF EXISTS "owner manages memberships" ON public.memberships;
CREATE POLICY "owner manages memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]));

-- Direct membership writes remain protected by the OWNER-only RLS policy above.\n-- The bootstrap RPC is SECURITY DEFINER and is the only path that creates the\n-- initial OWNER membership for a new organization.\n
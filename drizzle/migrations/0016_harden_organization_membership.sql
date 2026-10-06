-- Harden organization creation and membership administration.
-- Only the bootstrap RPC can create organizations; OWNER remains the only role
-- allowed to administer memberships.

REVOKE INSERT, DELETE ON public.organizations FROM authenticated;

DROP POLICY IF EXISTS "owner manages memberships" ON public.memberships;
CREATE POLICY "owner manages memberships" ON public.memberships
  FOR ALL TO authenticated
  USING (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]))
  WITH CHECK (public.has_org_role(organization_id, ARRAY['OWNER']::public.app_role[]));

-- Prevent ownership escalation by ensuring an owner cannot be created or
-- transferred through direct membership writes.
CREATE OR REPLACE FUNCTION public.validate_membership_role_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'OWNER' AND (
    TG_OP = 'INSERT'
    OR OLD.role IS DISTINCT FROM NEW.role
  ) THEN
    IF NOT public.has_org_role(NEW.organization_id, ARRAY['OWNER']::public.app_role[]) THEN
      RAISE EXCEPTION 'Only an existing owner can assign OWNER role';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_membership_role_change ON public.memberships;
CREATE TRIGGER trg_validate_membership_role_change
  BEFORE INSERT OR UPDATE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.validate_membership_role_change();

import { createFileRoute, redirect } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";
export const Route = createFileRoute("/_authenticated/_shell")({
  beforeLoad: async ({ context, location }) => {
    if (location.pathname !== "/dashboard") throw redirect({ to: "/dashboard" });
    const user = (context as any).user;
    if (!user?.id) throw redirect({ to: "/auth" });
    const { data: members, error } = await (supabase as any).from("household_members")
      .select("household_id, role").eq("user_id", user.id).order("created_at", { ascending: true }).limit(1);
    if (error) throw error;
    const member = members?.[0];
    if (!member) throw redirect({ to: "/onboarding" });
    const { data: household, error: householdError } = await (supabase as any).from("households")
      .select("id,name").eq("id", member.household_id).single();
    if (householdError) throw householdError;
    return { household, role: member.role };
  },
  component: ShellLayout,
});
function ShellLayout() {
  const { user } = Route.useRouteContext() as any;
  const { household, role } = Route.useRouteContext() as any;
  return <WorkspaceProvider value={{ workspace: { id: household.id, name: household.name }, role, userId: user.id, email: user.email ?? null }}><AppShell /></WorkspaceProvider>;
}

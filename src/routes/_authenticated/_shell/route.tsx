import { createFileRoute, redirect } from "@tanstack/react-router";
import { WorkspaceProvider } from "@/lib/workspace";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app/app-shell";

export const Route = createFileRoute("/_authenticated/_shell")({
  beforeLoad: async ({ context }) => {
    const { data: memberships, error } = await (supabase as any)
      .from("workspace_members").select("workspace_id, role")
      .eq("user_id", context.user.id).limit(1);
    if (error) throw error;
    const membership = memberships?.[0];
    if (!membership) throw redirect({ to: "/access-pending" });
    const { data: workspace, error: workspaceError } = await (supabase as any)
      .from("workspaces").select("id, name").eq("id", membership.workspace_id).single();
    if (workspaceError) throw workspaceError;
    return { workspace, role: membership.role };
  },
  component: ShellLayout,
});
function ShellLayout() {
  const { user } = Route.useRouteContext();
  const { workspace, role } = Route.useRouteContext() as any;
  return <WorkspaceProvider value={{ workspace, role, userId: user.id, email: user.email ?? null }}><AppShell /></WorkspaceProvider>;
}

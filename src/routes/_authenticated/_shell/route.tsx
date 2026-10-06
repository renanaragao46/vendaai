import { createFileRoute, redirect } from "@tanstack/react-router";
import { membershipQuery, OrgProvider } from "@/lib/org";
import { AppShell } from "@/components/app/app-shell";

export const Route = createFileRoute("/_authenticated/_shell")({
  beforeLoad: async ({ context }) => {
    const m = await context.queryClient.ensureQueryData(membershipQuery(context.user.id));
    if (!m || !m.org.onboarding_completed) throw redirect({ to: "/onboarding" });
    return { membership: m };
  },
  component: ShellLayout,
});

function ShellLayout() {
  const { user, membership } = Route.useRouteContext();
  return (
    <OrgProvider
      value={{ userId: user.id, email: user.email ?? null, role: membership.role, org: membership.org }}
    >
      <AppShell />
    </OrgProvider>
  );
}

import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, LogOut, ShieldCheck, Wallet, Target, BriefcaseBusiness, BookOpen, Network } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";

const NAV = [
  { to: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
] as const;

export function AppShell() {
  const { workspace, email, role } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  };
  return <div className="min-h-screen bg-background lg:grid lg:grid-cols-[250px_1fr]">
    <aside className="border-b bg-[oklch(0.19_0.035_195)] text-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:p-4">
      <div className="flex items-center gap-3 px-4 py-4 lg:px-2"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary font-bold">PV</span><div><p className="font-display font-bold tracking-wide">PROJETO DE VIDA</p><p className="text-xs text-white/60">Espaço compartilhado</p></div></div>
      <div className="mx-2 mt-2 rounded-xl bg-white/10 p-3"><p className="text-xs text-white/60">WORKSPACE</p><p className="mt-1 truncate text-sm font-semibold">{workspace.name}</p><p className="mt-1 text-xs text-white/60">{role === "owner" ? "Administrador" : "Membro"}</p></div>
      <nav className="mt-5 flex gap-2 overflow-x-auto px-2 lg:flex-col">
        {NAV.map((item) => <Link key={item.to} to={item.to} className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-sm text-white/80 hover:bg-white/10 hover:text-white" activeProps={{ className: "bg-white/15 text-white font-semibold" }}><item.icon className="h-4 w-4" />{item.label}</Link>)}
      </nav>
      <div className="mt-4 hidden px-3 text-xs text-white/50 lg:block">Módulos serão liberados progressivamente conforme a estrutura de dados for validada.</div>
      <div className="mt-4 flex items-center justify-between border-t border-white/10 px-4 py-4 text-xs text-white/70 lg:absolute lg:bottom-0 lg:left-0 lg:right-0"><span className="max-w-[170px] truncate">{email}</span><button onClick={signOut} className="rounded-md p-2 hover:bg-white/10" aria-label="Sair"><LogOut className="h-4 w-4" /></button></div>
    </aside>
    <div className="min-w-0"><header className="flex h-14 items-center justify-between border-b bg-card/70 px-5"><p className="text-sm font-medium">Painel de gestão</p><span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Sessão protegida</span></header><main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><Outlet /></main></div>
  </div>;
}

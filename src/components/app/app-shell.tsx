import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
export function AppShell() {
  const { workspace, email, role } = useWorkspace();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const signOut = async () => {
    await qc.cancelQueries(); qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true });
  };
  return <div className="min-h-screen bg-background">
    <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-sm font-bold text-white">PV</span>
          <span className="min-w-0"><span className="block truncate font-display text-sm font-bold tracking-wide">PROJETO DE VIDA</span><span className="block truncate text-xs text-muted-foreground">{workspace.name} · {role === "owner" ? "Administrador" : "Membro"}</span></span>
        </Link>
        <div className="flex items-center gap-3"><span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><ShieldCheck className="h-4 w-4 text-primary"/> Privado · {email}</span><button onClick={signOut} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium hover:bg-muted"><LogOut className="h-4 w-4"/> Sair</button></div>
      </div>
    </header>
    <main className="mx-auto max-w-[1600px] px-3 py-4 sm:px-6 sm:py-7"><Outlet /></main>
    <footer className="mx-auto max-w-[1600px] px-6 pb-6 text-center text-[11px] text-muted-foreground">Projeto de Vida · Dados sincronizados e protegidos por autenticação e RLS.</footer>
  </div>;
}

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: "forgot" } => ({ mode: s.mode === "forgot" ? "forgot" : undefined }),
  head: () => ({ meta: [{ title: "Acesso privado — Projeto de Vida" }] }),
  component: AuthPage,
});
const emailSchema = z.string().trim().max(255).refine((v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(v), "Digite um e-mail válido.");
function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<"login" | "forgot">(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const navigate = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
    const parsed = emailSchema.safeParse(normalized);
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (mode === "login" && (password.length < 8 || password.length > 72)) return toast.error("A senha deve ter entre 8 e 72 caracteres.");
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: parsed.data, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: window.location.origin + "/reset-password" });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) { toast.error((err as Error).message); }
    finally { setLoading(false); }
  };
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><Card className="w-full max-w-md p-7 shadow-soft sm:p-9">
    <Link to="/" className="mb-8 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">PV</span><span><b className="font-display">PROJETO DE VIDA</b><small className="block text-xs text-muted-foreground">Acesso privado</small></span></Link>
    <div className="mb-6 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4" /> Somente usuários autorizados</div>
    <h1 className="text-2xl font-semibold">{mode === "login" ? "Entrar no painel" : "Recuperar senha"}</h1>
    {sent ? <p className="mt-5 text-sm text-muted-foreground">Se o endereço estiver cadastrado, enviaremos as instruções de recuperação.</p> : <form onSubmit={submit} className="mt-6 space-y-4">
      <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      {mode === "login" && <div className="space-y-2"><Label htmlFor="password">Senha</Label><Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>}
      <Button className="w-full" type="submit" disabled={loading}>{loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{mode === "login" ? "Entrar" : "Enviar instruções"}</Button>
      <button type="button" className="w-full text-center text-sm text-muted-foreground hover:text-primary" onClick={() => { setMode(mode === "login" ? "forgot" : "login"); setSent(false); }}>{mode === "login" ? "Esqueci minha senha" : "Voltar ao login"}</button>
    </form>}
    <p className="mt-6 border-t pt-5 text-xs leading-5 text-muted-foreground">As contas são criadas pelo administrador do espaço. O cadastro público fica desativado para impedir acessos não autorizados.</p>
  </Card></main>;
}

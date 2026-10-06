import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

type Mode = "login" | "signup" | "forgot";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode?: Mode } => ({
    mode: s.mode === "signup" || s.mode === "forgot" ? s.mode : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — VendaAI" },
      { name: "description", content: "Acesse ou crie sua conta VendaAI." },
      { property: "og:title", content: "Entrar — VendaAI" },
      { property: "og:description", content: "Acesse ou crie sua conta VendaAI." },
    ],
  }),
  component: AuthPage,
});

const emailSchema = z
  .string()
  .trim()
  .max(255, "E-mail muito longo")
  .refine(
    (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(value),
    "Digite um e-mail válido, como nome@empresa.com",
  );
const passwordSchema = z.string().min(8, "Mínimo de 8 caracteres").max(72);

function AuthPage() {
  const search = Route.useSearch();
  const [mode, setMode] = useState<Mode>(search.mode ?? "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.replace(/[\u200B-\u200D\uFEFF]/g, "").trim().toLowerCase();
    const em = emailSchema.safeParse(normalizedEmail);
    if (!em.success) return toast.error(em.error.issues[0].message);
    if (mode !== "forgot") {
      const pw = passwordSchema.safeParse(password);
      if (!pw.success) return toast.error(pw.error.issues[0].message);
    }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: em.data, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: em.data,
          password,
          options: { emailRedirectTo: `${window.location.origin}/onboarding` },
        });
        if (error) throw error;
        if (data.session) navigate({ to: "/onboarding" });
        else setSent("Enviamos um link de confirmação para o seu e-mail. Confirme para continuar.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em.data, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSent("Se o e-mail existir, você receberá um link para redefinir a senha.");
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<Mode, string> = {
    login: "Bem-vindo de volta",
    signup: "Crie sua conta",
    forgot: "Recuperar senha",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm p-8 shadow-soft">
        <Link to="/" className="mb-6 flex items-center gap-2 font-display font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          VendaAI
        </Link>
        <h1 className="text-xl font-semibold">{titles[mode]}</h1>
        {sent ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">{sent}</p>
            <Button variant="outline" className="w-full" onClick={() => { setSent(null); setMode("login"); }}>
              Voltar ao login
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
            </Button>
            <div className="flex flex-col gap-1 text-center text-sm">
              {mode === "login" && (
                <>
                  <button type="button" className="text-primary hover:underline" onClick={() => setMode("forgot")}>
                    Esqueci minha senha
                  </button>
                  <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("signup")}>
                    Não tem conta? Cadastre-se
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button type="button" className="text-muted-foreground hover:underline" onClick={() => setMode("login")}>
                  Já tem conta? Entrar
                </button>
              )}
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

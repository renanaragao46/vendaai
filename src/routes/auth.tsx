import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck, Eye, EyeOff } from "lucide-react";
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
const emailSchema = z.string().trim().max(255).email("Digite um e-mail válido.");
function AuthPage() {
  const search = Route.useSearch();
  const [mode,setMode]=useState<"login"|"signup"|"forgot">(search.mode==="forgot"?"forgot":"login");
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [name,setName]=useState("");
  const [loading,setLoading]=useState(false); const [sent,setSent]=useState(false); const [show,setShow]=useState(false);
  const submit=async(e:React.FormEvent)=>{e.preventDefault(); const em=email.replace(/[\u200B-\u200D\uFEFF]/g,"").trim().toLowerCase(); const parsed=emailSchema.safeParse(em); if(!parsed.success)return toast.error(parsed.error.issues[0].message);
    if(mode!=="forgot"&&(password.length<8||password.length>72))return toast.error("A senha deve ter entre 8 e 72 caracteres.");
    setLoading(true);
    try {
      if(mode==="login"){const {error}=await supabase.auth.signInWithPassword({email:parsed.data,password});if(error)throw error;window.location.assign("/dashboard");}
      else if(mode==="signup"){const {data,error}=await supabase.auth.signUp({email:parsed.data,password,options:{data:{display_name:name.trim()},emailRedirectTo:window.location.origin+"/onboarding"}});if(error)throw error;
        if(data.session) window.location.assign("/onboarding"); else setSent(true);
      } else {const {error}=await supabase.auth.resetPasswordForEmail(parsed.data,{redirectTo:window.location.origin+"/reset-password"});if(error)throw error;setSent(true);}
    } catch(err){toast.error((err as Error).message);} finally{setLoading(false);}
  };
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
    <Card className="w-full max-w-md p-7 shadow-soft sm:p-9">
      <Link to="/" className="mb-8 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand font-bold text-white">PV</span><span><b className="font-display">PROJETO DE VIDA</b><small className="block text-xs text-muted-foreground">Espaço financeiro e estratégico privado</small></span></Link>
      <div className="mb-6 flex items-center gap-2 text-sm text-primary"><ShieldCheck className="h-4 w-4"/> Dados protegidos por conta individual</div>
      <h1 className="text-2xl font-semibold">{mode==="login"?"Entrar no painel":mode==="signup"?"Criar conta":"Recuperar senha"}</h1>
      {sent?<div className="mt-5 rounded-xl bg-muted p-4 text-sm leading-6 text-muted-foreground">Se o endereço estiver correto, enviaremos as instruções por e-mail. Após criar a conta, somente membros convidados conseguem acessar os dados do espaço compartilhado.</div>:
      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode==="signup"&&<div className="space-y-2"><Label htmlFor="name">Como devemos chamar você?</Label><Input id="name" value={name} onChange={e=>setName(e.target.value)} autoComplete="name" required/></div>}
        <div className="space-y-2"><Label htmlFor="email">E-mail</Label><Input id="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
        {mode!=="forgot"&&<div className="space-y-2"><Label htmlFor="password">Senha</Label><div className="relative"><Input id="password" type={show?"text":"password"} autoComplete={mode==="login"?"current-password":"new-password"} value={password} onChange={e=>setPassword(e.target.value)} required className="pr-11"/><button type="button" aria-label="Mostrar senha" className="absolute right-3 top-2.5 text-muted-foreground" onClick={()=>setShow(!show)}>{show?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button></div></div>}
        <Button className="w-full" type="submit" disabled={loading}>{loading&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}{mode==="login"?"Entrar":mode==="signup"?"Criar conta":"Enviar instruções"}</Button>
        <div className="flex flex-wrap justify-between gap-3 text-sm"><button type="button" className="text-muted-foreground hover:text-primary" onClick={()=>{setMode(mode==="login"?"forgot":"login");setSent(false)}}>{mode==="login"?"Esqueci minha senha":"Voltar ao login"}</button>{mode!=="forgot"&&<button type="button" className="text-primary hover:underline" onClick={()=>{setMode(mode==="signup"?"login":"signup");setSent(false)}}>{mode==="signup"?"Já tenho conta":"Criar conta"}</button>}</div>
      </form>}
      <p className="mt-6 border-t pt-5 text-xs leading-5 text-muted-foreground">O cadastro não libera dados automaticamente. O acesso ao espaço financeiro depende de convite e vínculo autorizado.</p>
    </Card>
  </main>;
}

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export const Route=createFileRoute("/_authenticated/onboarding")({head:()=>({meta:[{title:"Configuração inicial — Projeto de Vida"}]}),component:Onboarding});
const defaultProducts=[
 {name:"Escova Alisadora Multifuncional — MIMORA",store:"MIMORA / Kaiross",price:99.81,status:"teste",link:"https://pay.kaiross.com.br/nOphuKDcDiBL",notes:"Preço promocional histórico de R$99,81 — confirmar preço atual. A plataforma Kaiross informa valor líquido que já pode incluir fornecedor, taxas, NF e frete; não descontar esses itens novamente."},
 {name:"Escova 3 em 1 — MIMORA",store:"MIMORA / Kaiross",status:"teste",link:"https://pay.kaiross.com.br/RGPudV4LHhhx",notes:"Produto em teste. Confirmar preço, condições e especificações atuais na Kaiross."},
 {name:"Escova 5 em 1 — MIMORA",store:"MIMORA / Kaiross",status:"teste",link:"https://pay.kaiross.com.br/Zlgt0A9o0Nhl",notes:"Produto em teste. Confirmar preço, condições e especificações atuais na Kaiross."},
];
function Onboarding(){
 const {user}=Route.useRouteContext() as any;
 const [name,setName]=useState("Projeto de Vida");
 const [display,setDisplay]=useState(String(user.user_metadata?.display_name??""));
 const [busy,setBusy]=useState(false);
 const nav=useNavigate();
 const run=async(e:React.FormEvent)=>{
  e.preventDefault();setBusy(true);
  try{
   await (supabase as any).rpc("accept_my_invites");
   const {data:members,error:memberError}=await (supabase as any).from("household_members").select("household_id").eq("user_id",user.id).limit(1);
   if(memberError)throw memberError;
   let householdId=members?.[0]?.household_id as string|undefined;
   if(!householdId){
    const {data:createdId,error}=await (supabase as any).rpc("create_household",{p_name:name.trim()||"Projeto de Vida",p_display_name:display.trim()||"Administrador"});
    if(error)throw error;
    householdId=createdId as string;
   }
   if(householdId){
    const {data:existing,error:readError}=await (supabase as any).from("products").select("name").eq("household_id",householdId);
    if(readError)throw readError;
    const names=new Set((existing??[]).map((p:any)=>String(p.name).trim().toLowerCase()));
    const missing=defaultProducts.filter(p=>!names.has(p.name.toLowerCase())).map(p=>({...p,household_id:householdId,created_by:user.id}));
    if(missing.length){const {error}=await (supabase as any).from("products").insert(missing);if(error)throw error;}
   }
   nav({to:"/dashboard"});
  }catch(err){toast.error((err as Error).message)}
  finally{setBusy(false)}
 };
 return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10"><Card className="w-full max-w-lg p-7 sm:p-9">
  <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-5 w-5"/><span className="text-sm font-medium">Configuração protegida</span></div>
  <h1 className="mt-4 font-display text-2xl font-bold">Seu espaço de gestão</h1>
  <p className="mt-2 text-sm leading-6 text-muted-foreground">Se você recebeu um convite, vamos vinculá-lo automaticamente. Se for o primeiro acesso, criaremos o espaço e carregaremos o plano inicial, as rotinas, as regras, a biblioteca de conhecimento e os três produtos atuais da MIMORA como itens em teste — nunca como vendas realizadas.</p>
  <form onSubmit={run} className="mt-6 space-y-4">
   <div className="space-y-2"><Label>Nome do espaço</Label><Input value={name} onChange={e=>setName(e.target.value)} required/></div>
   <div className="space-y-2"><Label>Seu nome de exibição</Label><Input value={display} onChange={e=>setDisplay(e.target.value)} placeholder="Administrador"/></div>
   <Button className="w-full" disabled={busy}>{busy&&<Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Criar ou entrar no espaço</Button>
  </form>
  <p className="mt-5 text-xs leading-5 text-muted-foreground">Somente usuários vinculados ao mesmo espaço conseguem consultar ou alterar registros. O banco aplica políticas RLS em todas as tabelas.</p>
 </Card></main>
}

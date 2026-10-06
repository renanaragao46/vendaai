import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bot, BrainCircuit, CheckCircle2, CircleAlert, MessageSquareText, PauseCircle, PlayCircle, Send, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canManage, canWorkConversations, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/app/page-header";
import { RecordForm } from "@/components/app/record-form";
import type { FieldDef } from "@/components/app/form-fields";
import { runSalesEngine } from "@/features/ai-sales-engine/service";

export const Route = createFileRoute("/_authenticated/_shell/agente")({
  head: () => ({ meta: [{ title: "Agente IA — VendaAI" }] }),
  component: Page,
});

const FIELDS: FieldDef[] = [
  { name: "agent_name", label: "Nome do agente", type: "text", required: true },
  { name: "llm_provider", label: "Provedor LLM", type: "select", required: true, options: [{ value: "openai", label: "OpenAI" }] },
  { name: "llm_model", label: "Modelo", type: "text", required: true },
  { name: "tone", label: "Tom", type: "text" },
  { name: "emoji_usage", label: "Uso de emojis", type: "select", required: true, options: [{ value: "NONE", label: "Nenhum" }, { value: "LOW", label: "Pouco" }, { value: "MEDIUM", label: "Moderado" }, { value: "HIGH", label: "Muito" }] },
  { name: "target_audience", label: "Público-alvo", type: "text" },
  { name: "personality", label: "Personalidade", type: "textarea" },
  { name: "primary_objective", label: "Objetivo principal", type: "textarea" },
  { name: "language_rules", label: "Regras de linguagem", type: "textarea" },
  { name: "words_to_use", label: "Palavras para usar", type: "list", full: true },
  { name: "words_to_avoid", label: "Palavras para evitar", type: "list", full: true },
  { name: "is_active", label: "Agente ativo", type: "switch", full: true },
];

type SimulatorMessage = { role: "customer" | "ai" | "system"; content: string; meta?: { intent?: string; temperature?: string; stage?: string; confidence?: number; action?: string } };

function Simulator({ orgId, role, userId }: { orgId: string; role: ReturnType<typeof useOrg>["role"]; userId: string }) {
  const [conversationId, setConversationId] = useState<string>();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SimulatorMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const canUse = canWorkConversations(role);

  const send = async (value?: string) => {
    const text = (value ?? input).trim();
    if (!text || busy || !canUse) return;
    setBusy(true);
    setMessages((prev) => [...prev, { role: "customer", content: text }]);
    setInput("");
    try {
      const result = await runSalesEngine({ organization_id: orgId, conversation_id: conversationId, message: text });
      if (result.conversation_id) setConversationId(result.conversation_id);
      if (result.status === "success" && result.response) {
        setMessages((prev) => [...prev, { role: "ai", content: result.response!, meta: { intent: result.intent, temperature: result.temperature, stage: result.sales_stage, confidence: result.confidence, action: result.next_action } }]);
      } else if (result.status === "pending_configuration") {
        setMessages((prev) => [...prev, { role: "system", content: "Configuração de IA pendente" }]);
      } else {
        setMessages((prev) => [...prev, { role: "system", content: result.reason ?? "A conversa foi transferida para atendimento humano." }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "system", content: error instanceof Error ? error.message : "Falha ao executar o motor de IA." }]);
    } finally {
      setBusy(false);
    }
  };

  const setAIState = async (state: "AI_ACTIVE" | "HUMAN_ACTIVE") => {
    if (!conversationId || !canUse) return;
    const { error } = await (supabase as any).from("conversations")
      .update({ ai_state: state }).eq("id", conversationId).eq("organization_id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }

    if (state === "HUMAN_ACTIVE") {
      const { data: openHandoff, error: handoffLookupError } = await (supabase as any)
        .from("conversation_handoffs")
        .select("id")
        .eq("organization_id", orgId)
        .eq("conversation_id", conversationId)
        .eq("status", "OPEN")
        .maybeSingle();
      if (handoffLookupError) {
        toast.error(handoffLookupError.message);
        return;
      }
      if (!openHandoff) {
        const { error: handoffError } = await (supabase as any).from("conversation_handoffs").insert({
          organization_id: orgId,
          conversation_id: conversationId,
          reason: "Atendimento assumido manualmente",
          status: "OPEN",
          created_by: userId,
        });
        if (handoffError) {
          toast.error(handoffError.message);
          return;
        }
      }
    } else {
      const { error: closeError } = await (supabase as any).from("conversation_handoffs")
        .update({ status: "CLOSED", closed_by: userId, closed_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("conversation_id", conversationId)
        .eq("status", "OPEN");
      if (closeError) {
        toast.error(closeError.message);
        return;
      }
    }

    toast.success(state === "AI_ACTIVE" ? "IA reativada" : "Conversa assumida pelo humano");
  };

  const examples = ["Quanto custa?","Tem desconto?","Vocês entregam?","Quero comprar.","Está caro.","Vou pensar.","Posso pagar no Pix?","Quero falar com alguém."];

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="flex min-h-[620px] flex-col overflow-hidden">
        <div className="border-b p-4">
          <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5" /><div><p className="font-semibold">Testar IA</p><p className="text-xs text-muted-foreground">Simulação real pelo AI Sales Engine; nenhum WhatsApp é usado.</p></div></div>
        </div>
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.length === 0 && <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Envie uma mensagem ou use um exemplo. Sem chave LLM configurada, o sistema exibirá “Configuração de IA pendente” e não inventará uma resposta.</div>}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "customer" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${m.role === "customer" ? "bg-primary text-primary-foreground" : m.role === "system" ? "bg-muted text-muted-foreground" : "bg-muted"}`}>
                  <p>{m.content}</p>
                  {m.meta && <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2 text-[11px]">
                    <Badge variant="secondary">{m.meta.intent}</Badge><Badge variant="secondary">{m.meta.temperature}</Badge><Badge variant="secondary">{m.meta.stage}</Badge>
                    {typeof m.meta.confidence === "number" && <Badge variant="secondary">{Math.round(m.meta.confidence * 100)}%</Badge>}
                    <Badge variant="outline">{m.meta.action}</Badge>
                  </div>}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="border-t p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">{examples.map((example) => <Button key={example} variant="outline" size="sm" onClick={() => send(example)} disabled={!canUse || busy}>{example}</Button>)}</div>
          <div className="flex gap-2">
            <input className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} placeholder="Digite uma mensagem de teste…" disabled={!canUse || busy} />
            <Button onClick={() => void send()} disabled={!canUse || busy || !input.trim()}><Send className="mr-2 h-4 w-4" />Enviar</Button>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <p className="mb-3 font-semibold">Controle da conversa</p>
        <div className="space-y-2">
          <Button className="w-full justify-start" variant="outline" disabled={!conversationId || !canUse} onClick={() => void setAIState("HUMAN_ACTIVE")}><PauseCircle className="mr-2 h-4 w-4" />ASSUMIR CONVERSA</Button>
          <Button className="w-full justify-start" variant="outline" disabled={!conversationId || !canUse} onClick={() => void setAIState("AI_ACTIVE")}><PlayCircle className="mr-2 h-4 w-4" />DEVOLVER PARA IA</Button>
        </div>
        <div className="mt-5 rounded-lg border p-3 text-xs text-muted-foreground">
          <div className="mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Segredos ficam no backend.</div>
          <div className="flex items-center gap-2"><UserRound className="h-4 w-4" /> O pedido de humano pausa a IA.</div>
        </div>
      </Card>
    </div>
  );
}

function Activity({ orgId }: { orgId: string }) {
  const q = useQuery({
    queryKey: ["ai_runs", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("ai_runs").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Card className="overflow-hidden">
      <div className="border-b p-4"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5" /><div><p className="font-semibold">Atividade da IA</p><p className="text-xs text-muted-foreground">Execuções reais registradas em ai_runs.</p></div></div></div>
      <div className="divide-y">
        {q.isLoading && <p className="p-5 text-sm text-muted-foreground">Carregando…</p>}
        {!q.isLoading && q.data?.length === 0 && <p className="p-5 text-sm text-muted-foreground">Nenhuma execução registrada.</p>}
        {q.data?.map((run: any) => (
          <div key={run.id} className="grid gap-2 p-4 md:grid-cols-[1fr_auto]">
            <div><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{run.intent ?? "—"}</Badge><Badge variant="outline">{run.temperature ?? "—"}</Badge><Badge variant="outline">{run.sales_stage ?? "—"}</Badge><span className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString("pt-BR")}</span></div><p className="mt-1 text-sm">{run.generated_response ?? run.error ?? "Sem resposta gerada."}</p></div>
            <div className="text-right text-xs text-muted-foreground">{run.result}<br />{run.duration_ms ?? 0} ms</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Page() {
  const { org, role, userId } = useOrg();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["agent_configs", org.id],
    queryFn: async () => (await supabase.from("agent_configs").select("*").eq("organization_id", org.id).maybeSingle()).data,
  });
  const save = useMutation({
    mutationFn: async (p: Record<string, unknown>) => {
      const { error } = await supabase.from("agent_configs").upsert({ ...p, organization_id: org.id } as never, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Agente salvo"); qc.invalidateQueries({ queryKey: ["agent_configs"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Agente IA" description="Configuração, personalidade, teste e atividade do AI Sales Engine." />
      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config"><Bot className="mr-2 h-4 w-4" />Configuração</TabsTrigger>
          <TabsTrigger value="test"><BrainCircuit className="mr-2 h-4 w-4" />Testar IA</TabsTrigger>
          <TabsTrigger value="activity"><MessageSquareText className="mr-2 h-4 w-4" />Atividade da IA</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <Card className="p-6 shadow-soft">
            {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
              <RecordForm fields={FIELDS} row={q.data ?? null} onSave={(p) => save.mutate(p)} saving={save.isPending} disabled={!canManage(role)} />}
            <div className="mt-5 flex items-start gap-3 rounded-lg border p-4 text-sm">
              {q.data?.is_active ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <CircleAlert className="mt-0.5 h-5 w-5" />}
              <div><p className="font-medium">{q.data?.is_active ? "Agente habilitado para uso" : "Agente ainda não está ativo"}</p><p className="text-muted-foreground">A chave OPENAI_API_KEY nunca fica no frontend. Se ela não existir no Edge Function, o teste exibirá “Configuração de IA pendente”.</p></div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="test" className="mt-4"><Simulator orgId={org.id} role={role} userId={userId} /></TabsContent>
        <TabsContent value="activity" className="mt-4"><Activity orgId={org.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, MessageCircle, PauseCircle, PlayCircle, Search, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canWorkConversations, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/page-header";
import { ScrollArea } from "@/components/ui/scroll-area";

type Conversation = {
  id: string;
  contact_id: string | null;
  channel: string;
  status: string;
  ai_state: "AI_ACTIVE" | "HUMAN_ACTIVE";
  sales_stage: string;
  temperature: "COLD" | "WARM" | "HOT";
  summary: string | null;
  last_message_at: string | null;
  created_at: string;
};

type Message = {
  id: string;
  conversation_id: string;
  sender_type: "CUSTOMER" | "AI" | "HUMAN" | "SYSTEM";
  message_type: string;
  content: string;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/_shell/conversas")({
  head: () => ({ meta: [{ title: "Conversas — VendaAI" }] }),
  component: ConversationsPage,
});

function ConversationsPage() {
  const { org, role } = useOrg();
  const canWork = canWorkConversations(role);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "AI" | "HUMAN" | "HOT">("ALL");
  const [draft, setDraft] = useState("");

  const conversations = useQuery({
    queryKey: ["conversations", org.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("conversations")
        .select("*").eq("organization_id", org.id).order("last_message_at", { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as Conversation[];
    },
    refetchInterval: 5000,
  });

  const contacts = useQuery({
    queryKey: ["conversation_contacts", org.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("contacts")
        .select("id,name,phone").eq("organization_id", org.id);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; phone: string | null }>;
    },
  });

  const filtered = useMemo(() => {
    const contactMap = new Map((contacts.data ?? []).map((c) => [c.id, c]));
    const term = search.trim().toLowerCase();
    return (conversations.data ?? []).filter((c) => {
      if (filter === "AI" && c.ai_state !== "AI_ACTIVE") return false;
      if (filter === "HUMAN" && c.ai_state !== "HUMAN_ACTIVE") return false;
      if (filter === "HOT" && c.temperature !== "HOT") return false;
      if (!term) return true;
      const contact = c.contact_id ? contactMap.get(c.contact_id) : undefined;
      return [contact?.name, contact?.phone, c.summary, c.channel].filter(Boolean).some((v) => String(v).toLowerCase().includes(term));
    });
  }, [conversations.data, contacts.data, filter, search]);

  const activeId = selectedId ?? filtered[0]?.id ?? null;
  const active = conversations.data?.find((c) => c.id === activeId) ?? null;
  const activeContact = active?.contact_id ? contacts.data?.find((c) => c.id === active.contact_id) : undefined;

  const messages = useQuery({
    queryKey: ["conversation_messages", org.id, activeId],
    enabled: Boolean(activeId),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("messages")
        .select("*").eq("organization_id", org.id).eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Message[];
    },
    refetchInterval: 3000,
  });

  const stateMutation = useMutation({
    mutationFn: async (state: "AI_ACTIVE" | "HUMAN_ACTIVE") => {
      if (!activeId) return;
      const { error } = await (supabase as any).from("conversations")
        .update({ ai_state: state }).eq("organization_id", org.id).eq("id", activeId);
      if (error) throw error;
    },
    onSuccess: (_, state) => {
      toast.success(state === "AI_ACTIVE" ? "IA devolvida à conversa" : "Conversa assumida pelo humano");
      void qc.invalidateQueries({ queryKey: ["conversations", org.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!activeId || !draft.trim()) return;
      const { error } = await (supabase as any).from("messages").insert({
        organization_id: org.id,
        conversation_id: activeId,
        sender_type: "HUMAN",
        message_type: "TEXT",
        content: draft.trim(),
        status: "SENT",
      });
      if (error) throw error;
      const { error: conversationError } = await (supabase as any).from("conversations")
        .update({ ai_state: "HUMAN_ACTIVE", last_message_at: new Date().toISOString() })
        .eq("organization_id", org.id).eq("id", activeId);
      if (conversationError) throw conversationError;
    },
    onSuccess: () => {
      setDraft("");
      void qc.invalidateQueries({ queryKey: ["conversation_messages", org.id, activeId] });
      void qc.invalidateQueries({ queryKey: ["conversations", org.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contactLabel = activeContact?.name || activeContact?.phone || (active ? `Conversa ${active.id.slice(0, 8)}` : "Selecione uma conversa");

  return (
    <div className="space-y-5">
      <PageHeader title="Conversas" description="Inbox comercial centralizado. WhatsApp entra pelo mesmo motor quando a conta estiver conectada." />
      <Card className="overflow-hidden shadow-soft">
        <div className="grid min-h-[680px] lg:grid-cols-[320px_1fr]">
          <aside className="border-r">
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar conversa..." className="pl-9" />
              </div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto">
                {(["ALL","AI","HUMAN","HOT"] as const).map((value) => (
                  <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>
                    {value === "ALL" ? "Todas" : value === "AI" ? "IA" : value === "HUMAN" ? "Humano" : "Quentes"}
                  </Button>
                ))}
              </div>
            </div>
            <ScrollArea className="h-[590px]">
              {conversations.isLoading && <p className="p-5 text-sm text-muted-foreground">Carregando conversas...</p>}
              {!conversations.isLoading && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="mx-auto mb-3 h-8 w-8 opacity-50" />
                  Nenhuma conversa encontrada.
                  <p className="mt-2 text-xs">Use “Testar IA” em Agente IA para criar a primeira conversa real de teste.</p>
                </div>
              )}
              {filtered.map((conversation) => {
                const contact = conversation.contact_id ? contacts.data?.find((c) => c.id === conversation.contact_id) : undefined;
                return (
                  <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`w-full border-b p-4 text-left transition hover:bg-muted/50 ${activeId === conversation.id ? "bg-muted" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{contact?.name || contact?.phone || `Conversa ${conversation.id.slice(0, 8)}`}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{conversation.summary || "Sem resumo ainda"}</p>
                      </div>
                      <Badge variant={conversation.temperature === "HOT" ? "default" : "secondary"}>{conversation.temperature}</Badge>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{conversation.channel}</span><span>•</span><span>{conversation.sales_stage}</span><span>•</span>
                      <span>{conversation.ai_state === "AI_ACTIVE" ? "IA" : "Humano"}</span>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </aside>

          <section className="flex min-w-0 flex-col">
            {!active ? (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-muted-foreground">
                Selecione uma conversa para visualizar as mensagens.
              </div>
            ) : (
              <>
                <header className="flex items-center justify-between gap-3 border-b p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{contactLabel}</p>
                    <p className="text-xs text-muted-foreground">{activeContact?.phone || active.channel} • {active.sales_stage}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge>{active.temperature}</Badge>
                    {canWork && (
                      <Button size="sm" variant="outline" onClick={() => stateMutation.mutate(active.ai_state === "AI_ACTIVE" ? "HUMAN_ACTIVE" : "AI_ACTIVE")} disabled={stateMutation.isPending}>
                        {active.ai_state === "AI_ACTIVE" ? <><PauseCircle className="mr-2 h-4 w-4" />Assumir</> : <><PlayCircle className="mr-2 h-4 w-4" />Devolver IA</>}
                      </Button>
                    )}
                  </div>
                </header>
                <ScrollArea className="flex-1 p-5">
                  <div className="mx-auto max-w-3xl space-y-3">
                    {messages.isLoading && <p className="text-sm text-muted-foreground">Carregando mensagens...</p>}
                    {messages.data?.map((message) => {
                      const mine = message.sender_type === "HUMAN" || message.sender_type === "AI";
                      return (
                        <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            <div className="mb-1 flex items-center gap-2 text-[10px] opacity-70">
                              {message.sender_type === "AI" ? <Bot className="h-3 w-3" /> : message.sender_type === "HUMAN" ? <UserRound className="h-3 w-3" /> : null}
                              <span>{message.sender_type}</span><span>{new Date(message.created_at).toLocaleString("pt-BR")}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                <footer className="border-t p-3">
                  <div className="flex gap-2">
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void sendMutation.mutateAsync(); }} placeholder={active.ai_state === "AI_ACTIVE" ? "Assuma a conversa para responder manualmente" : "Digite a resposta do atendente..."} disabled={!canWork || active.ai_state === "AI_ACTIVE" || sendMutation.isPending} />
                    <Button onClick={() => void sendMutation.mutateAsync()} disabled={!canWork || active.ai_state === "AI_ACTIVE" || sendMutation.isPending || !draft.trim()}><Send className="mr-2 h-4 w-4" />Enviar</Button>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      </Card>
    </div>
  );
}

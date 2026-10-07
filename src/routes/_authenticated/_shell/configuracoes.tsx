import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, MessageSquare, ShieldCheck, PlugZap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canAdmin, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { RecordForm } from "@/components/app/record-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FieldDef } from "@/components/app/form-fields";

export const Route = createFileRoute("/_authenticated/_shell/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — VendaAI" }] }),
  component: Page,
});

const COMPANY_FIELDS: FieldDef[] = [
  { name: "name", label: "Nome da empresa", type: "text", required: true },
  { name: "segment", label: "Segmento", type: "text" },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "payment_methods", label: "Formas de pagamento", type: "list", full: true },
  { name: "policies", label: "Políticas", type: "textarea" },
  { name: "ai_tone", label: "Tom de voz", type: "text", full: true },
];

const WHATSAPP_FIELDS: FieldDef[] = [
  {
    name: "provider",
    label: "Método de conexão",
    type: "select",
    required: true,
    options: [
      { value: "META_CLOUD_API", label: "Meta Cloud API — oficial" },
      { value: "WHATSAPP_WEB", label: "WhatsApp Web — gateway próprio" },
    ],
    help: "A opção WhatsApp Web permite conectar números comuns ou Business por QR Code. Ela usa um gateway separado e pode ser desconectada pelo próprio WhatsApp.",
    full: true,
  },
  { name: "display_name", label: "Nome exibido", type: "text" },
  { name: "phone_number", label: "Número do WhatsApp", type: "text", help: "Pode ser um número de WhatsApp comum ou Business quando você usar o gateway próprio." },
  { name: "business_account_id", label: "WhatsApp Business Account ID", type: "text", help: "Usado somente na integração oficial da Meta." },
  { name: "phone_number_id", label: "Phone Number ID", type: "text", help: "Usado somente na integração oficial da Meta." },
];

type WhatsAppAccount = {
  id: string;
  organization_id: string;
  provider: "META_CLOUD_API" | "WHATSAPP_WEB";
  gateway_instance_id: string | null;
  gateway_status: string | null;
  status: "NOT_CONNECTED" | "PENDING" | "CONNECTED" | "ERROR" | "DISCONNECTED";
  display_name: string | null;
  phone_number: string | null;
  business_account_id: string | null;
  phone_number_id: string | null;
  webhook_verified_at: string | null;
  connected_at: string | null;
  last_error: string | null;
};

const statusLabel: Record<WhatsAppAccount["status"], string> = {
  NOT_CONNECTED: "Não conectado",
  PENDING: "API validada • aguardando webhook",
  CONNECTED: "Conectado",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

function WhatsAppTab({ orgId, role }: { orgId: string; role: ReturnType<typeof useOrg>["role"] }) {
  const qc = useQueryClient();
  const [gatewayResult, setGatewayResult] = useState<{ qr?: string | null; pairing_code?: string | null; status?: string } | null>(null);
  const account = useQuery({
    queryKey: ["whatsapp_account", orgId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_accounts")
        .select("*")
        .eq("organization_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as WhatsAppAccount | null;
    },
  });

  const save = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const provider = values.provider === "WHATSAPP_WEB" ? "WHATSAPP_WEB" : "META_CLOUD_API";
      const hasIdentifiers = provider === "WHATSAPP_WEB"
        ? Boolean(values.phone_number)
        : Boolean(values.business_account_id || values.phone_number_id);
      const payload = {
        organization_id: orgId,
        provider,
        status: account.data?.provider === provider && account.data?.status === "CONNECTED" ? "CONNECTED" : hasIdentifiers ? "PENDING" : "NOT_CONNECTED",
        display_name: values.display_name || null,
        phone_number: values.phone_number || null,
        business_account_id: provider === "META_CLOUD_API" ? values.business_account_id || null : null,
        phone_number_id: provider === "META_CLOUD_API" ? values.phone_number_id || null : null,
        gateway_instance_id: provider === "WHATSAPP_WEB"
          ? account.data?.gateway_instance_id ?? orgId
          : null,
        gateway_status: provider === "WHATSAPP_WEB" ? account.data?.gateway_status ?? "NOT_CONNECTED" : null,
        provider_config: provider === "WHATSAPP_WEB" ? { mode: "self_hosted_web" } : {},
      };
      const { error } = await (supabase as any).from("whatsapp_accounts").upsert(payload, { onConflict: "organization_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração do WhatsApp salva");
      void qc.invalidateQueries({ queryKey: ["whatsapp_account", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = account.data;
  const connected = data?.status === "CONNECTED";
  const isWeb = data?.provider === "WHATSAPP_WEB";



  const testConnection = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", { body: { organization_id: orgId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (result: { pending_webhook_verification?: boolean; gateway?: { qr?: string | null; pairing_code?: string | null; status?: string } }) => {
      if (result.gateway) setGatewayResult(result.gateway);
      toast.success(
        result?.pending_webhook_verification
          ? "Configuração iniciada. Abra o QR Code do gateway e conecte o WhatsApp pelo celular."
          : "WhatsApp validado e conectado",
      );
      void qc.invalidateQueries({ queryKey: ["whatsapp_account", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const error = data?.status === "ERROR";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="rounded-lg border p-2"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">Conexão de WhatsApp</p>
              <p className="text-sm text-muted-foreground">
                {isWeb
                  ? "Conecte um WhatsApp comum ou Business pelo gateway próprio usando QR Code."
                  : "Conexão oficial da Meta Cloud API, com validação do webhook antes de liberar o atendimento."}
              </p>
            </div>
          </div>
          <Badge variant={connected ? "default" : error ? "destructive" : "secondary"}>
            {statusLabel[data?.status ?? "NOT_CONNECTED"]}
          </Badge>
        </div>

        <div className="mt-5 rounded-lg border p-4 text-sm">
          <div className="flex gap-3">
            {connected ? <CheckCircle2 className="mt-0.5 h-5 w-5" /> : <CircleAlert className="mt-0.5 h-5 w-5" />}
            <div>
              <p className="font-medium">{connected ? "WhatsApp validado" : "Configuração necessária"}</p>
              <p className="mt-1 text-muted-foreground">
                {connected
                  ? isWeb
                    ? "O gateway está conectado e o VendaAI pode receber e enviar mensagens por esta sessão."
                    : "A conta foi marcada como conectada após o recebimento e validação de um webhook assinado da Meta."
                  : data?.status === "PENDING"
                    ? isWeb
                      ? "O número foi preparado. Use o gateway WhatsApp Web para gerar o QR Code e vincular o celular."
                      : "Os identificadores foram validados pela Meta. Agora configure o webhook da Meta; quando o primeiro evento assinado chegar, o VendaAI concluirá a conexão automaticamente."
                    : isWeb
                      ? "Clique em gerar conexão para iniciar o QR Code. O número pode ser comum ou Business; ele será identificado após o vínculo."
                      : "Informe os identificadores da conta. Token, App Secret e outras credenciais nunca são armazenados nesta tela; ficarão nos Secrets do backend."}
              </p>
              {data?.last_error && <p className="mt-2 text-destructive">{data.last_error}</p>}
            </div>
          </div>
        </div>

        <Button className="mt-4" variant="outline" onClick={() => testConnection.mutate()} disabled={!canAdmin(role) || testConnection.isPending || (!isWeb && (!data?.phone_number_id || !data?.business_account_id))}>
          <PlugZap className="mr-2 h-4 w-4" />{testConnection.isPending ? "Conectando…" : isWeb ? "Gerar conexão WhatsApp" : "Testar e conectar WhatsApp"}
        </Button>
        {isWeb && gatewayResult?.qr && !connected && (
          <div className="mt-4 rounded-lg border p-4">
            <p className="font-medium">Escaneie o QR Code no WhatsApp</p>
            <p className="mt-1 text-sm text-muted-foreground">No celular: WhatsApp → Dispositivos conectados → Conectar dispositivo.</p>
            <img src={gatewayResult.qr} alt="QR Code para conectar o WhatsApp" className="mx-auto mt-4 h-64 w-64 rounded-md border bg-white p-2" />
          </div>
        )}
        {isWeb && gatewayResult?.pairing_code && !connected && (
          <div className="mt-4 rounded-lg border p-4 text-center">
            <p className="font-medium">Código de conexão</p>
            <p className="mt-2 text-2xl font-bold tracking-widest">{gatewayResult.pairing_code}</p>
            <p className="mt-1 text-xs text-muted-foreground">Use o recurso de conexão por código do WhatsApp, se disponível no aparelho.</p>
          </div>
        )}

        <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{isWeb
            ? "O modo WhatsApp Web usa uma sessão separada do aplicativo. O VendaAI não armazena QR Codes nem chaves da sessão no banco."
            : "Até que a integração oficial esteja configurada e validada, nenhuma mensagem real será enviada e nenhuma conexão será simulada."}</p>
        </div>
      </Card>

      <Card className="p-6">
        {account.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando configuração…</p>
        ) : (
          <RecordForm
            fields={WHATSAPP_FIELDS}
            row={data ?? null}
            onSave={(values) => save.mutate(values)}
            saving={save.isPending}
            disabled={!canAdmin(role)}
          />
        )}
      </Card>
    </div>
  );
}

function Page() {
  const { org, role } = useOrg();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (p: Record<string, unknown>) => {
      const { error } = await supabase.from("organizations").update(p as never).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      void qc.invalidateQueries({ queryKey: ["membership"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Empresa, integração WhatsApp e segurança das credenciais." />
      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Empresa</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-4">
          <Card className="p-6 shadow-soft">
            <RecordForm
              fields={COMPANY_FIELDS}
              row={org}
              onSave={(p) => save.mutate(p)}
              saving={save.isPending}
              disabled={!canAdmin(role)}
            />
          </Card>
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppTab orgId={org.id} role={role} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

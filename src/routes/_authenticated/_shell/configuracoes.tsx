import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, CircleAlert, MessageSquare, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { canAdmin, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { RecordForm } from "@/components/app/record-form";
import { Badge } from "@/components/ui/badge";
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
  { name: "display_name", label: "Nome exibido no WhatsApp", type: "text" },
  { name: "phone_number", label: "Número do WhatsApp", type: "text" },
  { name: "business_account_id", label: "WhatsApp Business Account ID", type: "text" },
  { name: "phone_number_id", label: "Phone Number ID", type: "text" },
];

type WhatsAppAccount = {
  id: string;
  organization_id: string;
  provider: string;
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
  PENDING: "Configuração pendente",
  CONNECTED: "Conectado",
  ERROR: "Erro",
  DISCONNECTED: "Desconectado",
};

function WhatsAppTab({ orgId, role }: { orgId: string; role: ReturnType<typeof useOrg>["role"] }) {
  const qc = useQueryClient();
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
      const hasIdentifiers = Boolean(values.business_account_id || values.phone_number_id || values.phone_number);
      const payload = {
        organization_id: orgId,
        provider: "META_CLOUD_API",
        status: account.data?.status === "CONNECTED" ? "CONNECTED" : hasIdentifiers ? "PENDING" : "NOT_CONNECTED",
        display_name: values.display_name || null,
        phone_number: values.phone_number || null,
        business_account_id: values.business_account_id || null,
        phone_number_id: values.phone_number_id || null,
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
  const error = data?.status === "ERROR";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="rounded-lg border p-2"><MessageSquare className="h-5 w-5" /></div>
            <div>
              <p className="font-semibold">WhatsApp Business Platform</p>
              <p className="text-sm text-muted-foreground">Conexão oficial da Meta. O VendaAI não considera uma conta conectada até a verificação do webhook.</p>
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
                  ? "A conta foi marcada como conectada após a validação da integração."
                  : "Informe os identificadores da conta. Token, App Secret e outras credenciais nunca são armazenados nesta tela; ficarão nos Secrets do backend."}
              </p>
              {data?.last_error && <p className="mt-2 text-destructive">{data.last_error}</p>}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Até que a integração oficial esteja configurada e validada, nenhuma mensagem real será enviada e nenhuma conexão será simulada.</p>
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

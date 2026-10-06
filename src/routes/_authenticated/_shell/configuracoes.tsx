import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canAdmin, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { RecordForm } from "@/components/app/record-form";
import type { FieldDef } from "@/components/app/form-fields";

export const Route = createFileRoute("/_authenticated/_shell/configuracoes")({
  head: () => ({ meta: [{ title: "Configurações — VendaAI" }] }),
  component: Page,
});

const FIELDS: FieldDef[] = [
  { name: "name", label: "Nome da empresa", type: "text", required: true },
  { name: "segment", label: "Segmento", type: "text" },
  { name: "description", label: "Descrição", type: "textarea" },
  { name: "payment_methods", label: "Formas de pagamento", type: "list", full: true },
  { name: "policies", label: "Políticas", type: "textarea" },
  { name: "ai_tone", label: "Tom de voz", type: "text", full: true },
];

function Page() {
  const { org, role } = useOrg();
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (p: Record<string, unknown>) => {
      const { error } = await supabase.from("organizations").update(p as never).eq("id", org.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Configurações salvas"); qc.invalidateQueries({ queryKey: ["membership"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" description="Dados da empresa. Integrações (WhatsApp, pagamentos): configuração pendente." />
      <Card className="p-6 shadow-soft">
        <RecordForm fields={FIELDS} row={org} onSave={(p) => save.mutate(p)} saving={save.isPending} disabled={!canAdmin(role)} />
      </Card>
    </div>
  );
}

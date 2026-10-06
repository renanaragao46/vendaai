import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canManage, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { RecordForm } from "@/components/app/record-form";
import type { FieldDef } from "@/components/app/form-fields";

export const Route = createFileRoute("/_authenticated/_shell/agente")({
  head: () => ({ meta: [{ title: "Agente IA — VendaAI" }] }),
  component: Page,
});

const FIELDS: FieldDef[] = [
  { name: "agent_name", label: "Nome do agente", type: "text", required: true },
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

function Page() {
  const { org, role } = useOrg();
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
      <PageHeader title="Agente IA" description="Configuração salva. O motor de IA será conectado em uma fase futura (configuração pendente)." />
      <Card className="p-6 shadow-soft">
        {q.isLoading ? <p className="text-sm text-muted-foreground">Carregando…</p> :
          <RecordForm fields={FIELDS} row={q.data ?? null} onSave={(p) => save.mutate(p)} saving={save.isPending} disabled={!canManage(role)} />}
      </Card>
    </div>
  );
}

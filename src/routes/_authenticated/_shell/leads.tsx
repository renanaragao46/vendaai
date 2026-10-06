import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/app/crud-page";
import { brl, canManage, useOrg } from "@/lib/org";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/_shell/leads")({
  head: () => ({ meta: [{ title: "CRM / Leads — VendaAI" }] }),
  component: Page,
});

const TEMP = { COLD: "Frio", WARM: "Morno", HOT: "Quente" } as Record<string, string>;

function Page() {
  const { org, role } = useOrg();
  const opts = useQuery({
    queryKey: ["lead-options", org.id],
    queryFn: async () => {
      const [s, c, p, m] = await Promise.all([
        supabase.from("pipeline_stages").select("id,name").eq("organization_id", org.id).order("position"),
        supabase.from("contacts").select("id,name").eq("organization_id", org.id),
        supabase.from("products").select("id,name").eq("organization_id", org.id),
        supabase.from("memberships").select("user_id, profile:profiles(email)").eq("organization_id", org.id),
      ]);
      const o = (rows: { id: string; name: string }[] | null) => (rows ?? []).map((r) => ({ value: r.id, label: r.name }));
      return {
        stages: o(s.data), contacts: o(c.data), products: o(p.data),
        members: (m.data ?? []).map((r) => ({ value: r.user_id, label: (r.profile as { email: string | null } | null)?.email ?? r.user_id })),
      };
    },
  });
  const stageName = (id: unknown) => opts.data?.stages.find((s) => s.value === id)?.label ?? "—";
  return (
    <div className="space-y-6">
      <PageHeader title="CRM / Leads" description="Oportunidades por etapa do funil." />
      <Tabs defaultValue="l">
        <TabsList><TabsTrigger value="l">Leads</TabsTrigger><TabsTrigger value="t">Tags</TabsTrigger></TabsList>
        <TabsContent value="l">
          <CrudPage embedded table="leads" title="Leads" singular="Lead" canCreate canEdit canDelete={canManage(role)}
            defaults={{ temperature: "COLD", stage_id: opts.data?.stages[0]?.value }}
            fields={[
              { name: "title", label: "Título", type: "text", required: true },
              { name: "contact_id", label: "Contato", type: "select", options: opts.data?.contacts ?? [] },
              { name: "stage_id", label: "Etapa", type: "select", options: opts.data?.stages ?? [] },
              { name: "temperature", label: "Temperatura", type: "select", required: true, options: Object.entries(TEMP).map(([value, label]) => ({ value, label })) },
              { name: "assignee_id", label: "Responsável", type: "select", options: opts.data?.members ?? [] },
              { name: "product_id", label: "Produto", type: "select", options: opts.data?.products ?? [] },
              { name: "potential_value", label: "Valor potencial", type: "number" },
              { name: "last_interaction_at", label: "Última interação", type: "datetime" },
              { name: "next_action", label: "Próxima ação", type: "text" },
              { name: "next_action_at", label: "Data da próxima ação", type: "datetime" },
              { name: "notes", label: "Notas", type: "textarea" },
            ]}
            columns={[
              { key: "title", label: "Lead" },
              { key: "stage_id", label: "Etapa", render: (r) => stageName(r.stage_id) },
              { key: "temperature", label: "Temp.", render: (r) => <Badge variant={r.temperature === "HOT" ? "destructive" : "secondary"}>{TEMP[String(r.temperature)]}</Badge> },
              { key: "potential_value", label: "Valor", render: (r) => brl(Number(r.potential_value ?? 0)) },
              { key: "next_action", label: "Próxima ação" },
            ]}
          />
        </TabsContent>
        <TabsContent value="t">
          <CrudPage embedded table="tags" title="Tags" singular="Tag" canCreate canEdit canDelete={canManage(role)}
            fields={[{ name: "name", label: "Nome", type: "text", required: true }, { name: "color", label: "Cor", type: "text" }]}
            columns={[{ key: "name", label: "Nome" }, { key: "color", label: "Cor" }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

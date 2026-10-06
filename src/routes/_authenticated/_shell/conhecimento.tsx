import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/app/crud-page";
import { canManage, useOrg } from "@/lib/org";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/_shell/conhecimento")({
  head: () => ({ meta: [{ title: "Conhecimento — VendaAI" }] }),
  component: Page,
});

const KINDS = [["COMPANY", "Empresa"], ["FAQ", "FAQs"], ["POLICY", "Políticas"], ["OBJECTION", "Objeções"], ["RULE", "Regras"]] as const;

function Page() {
  const { role } = useOrg();
  const w = canManage(role);
  return (
    <div className="space-y-6">
      <PageHeader title="Base de conhecimento" description="O que seu agente precisa saber." />
      <Tabs defaultValue="COMPANY">
        <TabsList className="flex-wrap h-auto">{KINDS.map(([k, l]) => <TabsTrigger key={k} value={k}>{l}</TabsTrigger>)}</TabsList>
        {KINDS.map(([k, l]) => (
          <TabsContent key={k} value={k}>
            <CrudPage embedded table="knowledge_items" title={l} singular="Item" filter={{ kind: k }} canCreate={w} canEdit={w} canDelete={w}
              fields={[{ name: "title", label: "Título", type: "text", required: true, full: true }, { name: "content", label: "Conteúdo", type: "textarea", required: true }]}
              columns={[{ key: "title", label: "Título" }, { key: "content", label: "Conteúdo" }]}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

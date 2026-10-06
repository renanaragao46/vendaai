import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CrudPage } from "@/components/app/crud-page";
import { brl, canManage, useOrg } from "@/lib/org";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/_shell/produtos")({
  head: () => ({ meta: [{ title: "Produtos — VendaAI" }] }),
  component: Page,
});

function Page() {
  const { role, org } = useOrg();
  const w = canManage(role);
  const cats = useQuery({
    queryKey: ["product_categories", org.id, "opts"],
    queryFn: async () => (await supabase.from("product_categories").select("id,name").eq("organization_id", org.id)).data ?? [],
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Produtos" description="Catálogo usado pelo CRM e pelo agente." />
      <Tabs defaultValue="p">
        <TabsList><TabsTrigger value="p">Produtos</TabsTrigger><TabsTrigger value="c">Categorias</TabsTrigger></TabsList>
        <TabsContent value="p">
          <CrudPage embedded table="products" title="Produtos" singular="Produto" canCreate={w} canEdit={w} canDelete={w}
            defaults={{ status: "ACTIVE" }}
            fields={[
              { name: "name", label: "Nome", type: "text", required: true },
              { name: "category_id", label: "Categoria", type: "select", options: (cats.data ?? []).map((c) => ({ value: c.id, label: c.name })) },
              { name: "price", label: "Preço", type: "number", required: true },
              { name: "promo_price", label: "Preço promocional", type: "number" },
              { name: "stock", label: "Estoque", type: "number" },
              { name: "status", label: "Status", type: "select", required: true, options: [{ value: "ACTIVE", label: "Ativo" }, { value: "INACTIVE", label: "Inativo" }, { value: "DRAFT", label: "Rascunho" }] },
              { name: "image_url", label: "URL da imagem", type: "url" },
              { name: "checkout_url", label: "Link de checkout", type: "url" },
              { name: "benefits", label: "Benefícios", type: "list", full: true },
              { name: "features", label: "Características", type: "list", full: true },
              { name: "description", label: "Descrição", type: "textarea" },
            ]}
            columns={[
              { key: "name", label: "Nome" },
              { key: "price", label: "Preço", render: (r) => brl(Number(r.price)) },
              { key: "stock", label: "Estoque" }, { key: "status", label: "Status" },
            ]}
          />
        </TabsContent>
        <TabsContent value="c">
          <CrudPage embedded table="product_categories" title="Categorias" singular="Categoria" canCreate={w} canEdit={w} canDelete={w}
            fields={[{ name: "name", label: "Nome", type: "text", required: true }, { name: "description", label: "Descrição", type: "textarea" }]}
            columns={[{ key: "name", label: "Nome" }, { key: "description", label: "Descrição" }]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

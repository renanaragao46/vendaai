import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { brl, useOrg } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — VendaAI" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { org } = useOrg();
  const q = useQuery({
    queryKey: ["dashboard", org.id],
    queryFn: async () => {
      const c = (t: "contacts" | "leads" | "products") =>
        supabase.from(t).select("id", { count: "exact", head: true }).eq("organization_id", org.id);
      const [contacts, leads, products, hot, paid] = await Promise.all([
        c("contacts"), c("leads"), c("products"),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("organization_id", org.id).eq("temperature", "HOT"),
        supabase.from("orders").select("total_amount").eq("organization_id", org.id).eq("status", "PAID"),
      ]);
      return {
        contacts: contacts.count ?? 0, leads: leads.count ?? 0, products: products.count ?? 0,
        hot: hot.count ?? 0, revenue: (paid.data ?? []).reduce((s, o) => s + Number(o.total_amount), 0),
        sales: paid.data?.length ?? 0,
      };
    },
  });
  const d = q.data;
  const cards = [
    ["Contatos", d?.contacts], ["Leads", d?.leads], ["Leads quentes", d?.hot],
    ["Produtos", d?.products], ["Vendas pagas", d?.sales], ["Receita", d ? brl(d.revenue) : undefined],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader title={`Olá, ${org.name}`} description="Métricas reais da sua operação." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, v]) => (
          <Card key={label} className="p-5 shadow-soft">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{q.isLoading ? "…" : (v ?? 0)}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

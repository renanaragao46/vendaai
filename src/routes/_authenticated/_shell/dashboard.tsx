import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, TrendingUp, TrendingDown, CreditCard, Target, BriefcaseBusiness, Activity, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/workspace";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/_shell/dashboard")({
  head: () => ({ meta: [{ title: "Visão geral — Projeto de Vida" }] }),
  component: Dashboard,
});
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
function Dashboard() {
  const { workspace } = useWorkspace();
  const query = useQuery({
    queryKey: ["life-overview", workspace.id],
    queryFn: async () => {
      const db = supabase as any;
      const [tx, debts, goals, projects, logs] = await Promise.all([
        db.from("transactions").select("amount,direction,transaction_date").eq("workspace_id", workspace.id),
        db.from("debts").select("current_balance,status").eq("workspace_id", workspace.id),
        db.from("goals").select("id,status").eq("workspace_id", workspace.id),
        db.from("projects").select("id,status").eq("workspace_id", workspace.id),
        db.from("daily_logs").select("gross_revenue,fuel_cost,rental_cost,other_costs,log_date").eq("workspace_id", workspace.id),
      ]);
      for (const result of [tx, debts, goals, projects, logs]) if (result.error) throw result.error;
      const now = new Date(); const month = now.toISOString().slice(0,7);
      const monthTx = (tx.data ?? []).filter((r: any) => String(r.transaction_date).startsWith(month));
      const income = monthTx.filter((r: any) => r.direction === "income").reduce((s: number,r: any) => s + Number(r.amount),0);
      const expenses = monthTx.filter((r: any) => r.direction === "expense").reduce((s: number,r: any) => s + Number(r.amount),0);
      const debt = (debts.data ?? []).filter((r: any) => r.status === "active").reduce((s: number,r: any) => s + Number(r.current_balance ?? 0),0);
      const activeProjects = (projects.data ?? []).filter((r: any) => r.status === "active").length;
      const activeGoals = (goals.data ?? []).filter((r: any) => r.status === "active").length;
      const operationNet = (logs.data ?? []).reduce((s: number,r: any) => s + Number(r.gross_revenue) - Number(r.fuel_cost) - Number(r.rental_cost) - Number(r.other_costs),0);
      return { income, expenses, debt, activeProjects, activeGoals, operationNet, balance: income-expenses };
    },
  });
  const d = query.data;
  const cards = [
    { label: "Receitas registradas no mês", value: money(d?.income ?? 0), icon: TrendingUp, note: "Entradas lançadas" },
    { label: "Despesas registradas no mês", value: money(d?.expenses ?? 0), icon: TrendingDown, note: "Saídas lançadas" },
    { label: "Resultado do mês", value: money(d?.balance ?? 0), icon: Wallet, note: "Receitas menos despesas" },
    { label: "Saldo de dívidas", value: money(d?.debt ?? 0), icon: CreditCard, note: "Saldo devedor cadastrado" },
    { label: "Projetos ativos", value: String(d?.activeProjects ?? 0), icon: BriefcaseBusiness, note: "Frentes em execução" },
    { label: "Metas ativas", value: String(d?.activeGoals ?? 0), icon: Target, note: "Objetivos acompanhados" },
  ];
  return <div className="space-y-7">
    <section className="rounded-2xl bg-[oklch(0.19_0.035_195)] p-6 text-white sm:p-8"><p className="text-xs font-semibold uppercase tracking-[.18em] text-white/60">Painel central</p><h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Construir com método.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">Acompanhe o dinheiro, proteja o caixa, fortaleça as fontes de renda e transforme metas em execução diária.</p><div className="mt-6 flex flex-wrap gap-3 text-xs"><span className="rounded-full bg-white/10 px-3 py-2">Plano de 180 dias</span><span className="rounded-full bg-white/10 px-3 py-2">Gestão compartilhada</span><span className="rounded-full bg-white/10 px-3 py-2">Dados privados</span></div></section>
    <section><div className="mb-4 flex items-end justify-between"><div><h2 className="font-display text-xl font-semibold">Indicadores principais</h2><p className="mt-1 text-sm text-muted-foreground">Valores calculados a partir dos lançamentos cadastrados.</p></div><span className="text-xs text-muted-foreground">{query.isLoading ? "Atualizando…" : "Dados sincronizados"}</span></div>
      {query.error && <p className="mb-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Não foi possível carregar os indicadores. Verifique se a migração do banco foi aplicada.</p>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((c) => <Card key={c.label} className="p-5 shadow-soft"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{c.label}</span><c.icon className="h-5 w-5 text-primary" /></div><p className="mt-4 font-display text-2xl font-semibold">{query.isLoading ? "—" : c.value}</p><p className="mt-1 text-xs text-muted-foreground">{c.note}</p></Card>)}</div>
    </section>
    <section className="grid gap-4 lg:grid-cols-2"><Card className="p-5"><div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h3 className="font-semibold">Resultado operacional acumulado</h3></div><p className="mt-3 font-display text-3xl font-semibold">{money(d?.operationNet ?? 0)}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">Receita bruta menos combustível, aluguel do veículo e demais custos lançados nos registros diários. Não substitui o fechamento financeiro completo.</p></Card><Card className="p-5"><div className="flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-primary" /><h3 className="font-semibold">Próxima etapa</h3></div><p className="mt-3 text-sm leading-6 text-muted-foreground">Cadastrar o espaço compartilhado, validar os acessos e depois alimentar dívidas, despesas fixas, operações e metas com valores reais. Nenhum número de demonstração será tratado como saldo verdadeiro.</p></Card></section>
  </div>;
}

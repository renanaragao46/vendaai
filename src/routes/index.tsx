import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, KanbanSquare, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VendaAI — Seu time de vendas com IA" },
      {
        name: "description",
        content: "CRM, catálogo, base de conhecimento e agente de vendas com IA em uma só plataforma.",
      },
      { property: "og:title", content: "VendaAI — Seu time de vendas com IA" },
      {
        property: "og:description",
        content: "CRM, catálogo, base de conhecimento e agente de vendas com IA em uma só plataforma.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: KanbanSquare, title: "CRM com pipeline", text: "Leads por etapa, temperatura e próxima ação." },
  { icon: Package, title: "Catálogo de produtos", text: "Preços, promoções, estoque e links de checkout." },
  { icon: Bot, title: "Agente de IA", text: "Configure tom, objetivos e regras do seu vendedor virtual." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2 font-display font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          VendaAI
        </div>
        <Button asChild variant="ghost">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-16 text-center sm:pt-24">
        <span className="inline-flex rounded-full border bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          Vendas conversacionais com IA
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold text-foreground sm:text-6xl">
          Transforme conversas em <span className="bg-brand bg-clip-text text-transparent">vendas</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Organize leads, produtos e conhecimento do seu negócio e prepare um agente de IA que vende do seu jeito.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/auth" search={{ mode: "signup" }}>Criar conta grátis</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/auth">Já tenho conta</Link>
          </Button>
        </div>
        <div className="mt-20 grid gap-4 text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-soft">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

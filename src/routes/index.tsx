import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Target, Wallet, Route as RouteIcon, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Projeto de Vida — Painel privado" },
      { name: "description", content: "Gestão familiar, financeira e empresarial em um só lugar." },
    ],
  }),
  component: Landing,
});

const pillars = [
  { icon: Wallet, title: "Finanças e patrimônio", text: "Entradas, saídas, dívidas, reservas e evolução patrimonial." },
  { icon: RouteIcon, title: "Operações e negócios", text: "Uber/99, vendas presenciais, MIMORA e novos projetos." },
  { icon: Target, title: "Metas e execução", text: "Plano de 180 dias, rotina, tarefas e prioridades." },
  { icon: BookOpen, title: "Conhecimento", text: "Biblioteca de aprendizados, decisões e regras do projeto." },
];

function Landing() {
  return (
    <main className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-white font-bold">PV</div>
          <div><p className="font-display font-bold">PROJETO DE VIDA</p><p className="text-xs text-muted-foreground">Planejamento • execução • patrimônio</p></div>
        </div>
        <Button asChild><Link to="/auth">Acessar painel <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
      </header>
      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-16 pt-12 sm:px-8 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-20">
        <div>
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Espaço privado para duas pessoas</div>
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-6xl">Uma vida organizada se constrói com <span className="text-primary">decisões bem executadas.</span></h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">Centralize a vida financeira, as operações de renda, os negócios, as metas e a rotina em um único painel compartilhado.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/auth">Entrar com segurança <ArrowRight className="ml-2 h-4 w-4" /></Link></Button><span className="self-center text-xs text-muted-foreground">Acesso somente por contas autorizadas.</span></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {pillars.map((p) => <div key={p.title} className="rounded-2xl border bg-card p-5 shadow-soft"><p.icon className="h-6 w-6 text-primary" /><h2 className="mt-4 font-semibold">{p.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{p.text}</p></div>)}
        </div>
      </section>
      <footer className="mx-auto flex max-w-7xl items-center gap-2 border-t px-5 py-6 text-xs text-muted-foreground sm:px-8"><ShieldCheck className="h-4 w-4" /> Seus dados ficam no banco privado, protegidos por autenticação e políticas de acesso.</footer>
    </main>
  );
}

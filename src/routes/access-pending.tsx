import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/access-pending")({ head: () => ({ meta: [{ title: "Acesso pendente — Projeto de Vida" }] }), component: Page });
function Page() { return <main className="flex min-h-screen items-center justify-center bg-background px-4"><Card className="w-full max-w-lg p-8"><ShieldCheck className="h-8 w-8 text-primary" /><h1 className="mt-4 text-2xl font-semibold">Conta criada. Acesso ainda não vinculado.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Este usuário ainda não foi adicionado ao espaço compartilhado. Por segurança, somente os dois membros autorizados terão acesso aos dados. Peça ao administrador para concluir o vínculo no banco.</p><Button asChild className="mt-6 w-full" variant="outline"><Link to="/auth">Voltar ao login</Link></Button></Card></main>; }

import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";

export const Route = createFileRoute("/_authenticated/_shell/conversas")({
  head: () => ({ meta: [{ title: "Conversas — VendaAI" }] }),
  component: () => (
    <div className="space-y-6">
      <PageHeader title="Conversas" />
      <Card className="p-10 text-center shadow-soft">
        <p className="font-medium">Configuração pendente</p>
        <p className="mt-1 text-sm text-muted-foreground">A integração com WhatsApp ainda não foi conectada.</p>
      </Card>
    </div>
  ),
});

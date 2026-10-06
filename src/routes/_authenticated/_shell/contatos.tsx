import { createFileRoute } from "@tanstack/react-router";
import { CrudPage } from "@/components/app/crud-page";
import { canManage, useOrg } from "@/lib/org";

export const Route = createFileRoute("/_authenticated/_shell/contatos")({
  head: () => ({ meta: [{ title: "Contatos — VendaAI" }] }),
  component: Page,
});

function Page() {
  const { role } = useOrg();
  return (
    <CrudPage
      table="contacts" title="Contatos" singular="Contato" description="Sua base de clientes e interessados."
      canCreate canEdit canDelete={canManage(role)}
      fields={[
        { name: "name", label: "Nome", type: "text", required: true },
        { name: "phone", label: "Telefone", type: "text" },
        { name: "email", label: "E-mail", type: "email" },
        { name: "source", label: "Origem", type: "text" },
        { name: "tags", label: "Tags", type: "list", full: true },
        { name: "notes", label: "Notas", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "Nome" }, { key: "phone", label: "Telefone" },
        { key: "email", label: "E-mail" }, { key: "source", label: "Origem" },
      ]}
    />
  );
}

import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { membershipQuery } from "@/lib/org";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [{ title: "Configuração inicial — VendaAI" }] }),
  component: Onboarding,
});

function Onboarding() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const m = useQuery(membershipQuery(user.id));
  const [f, setF] = useState({
    name: "", segment: "", description: "", products: "", payment_methods: "", policies: "", ai_tone: "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim() && !m.data) return toast.error("Informe o nome da empresa");
    setSaving(true);
    try {
      let orgId = m.data?.org.id;
      if (!orgId) {
        const { data, error } = await supabase.rpc("create_organization", { _name: f.name });
        if (error) throw error;
        orgId = data as string;
      }
      const { error } = await supabase.from("organizations").update({
        ...(f.name.trim() ? { name: f.name.trim() } : {}),
        segment: f.segment || null, description: f.description || null, policies: f.policies || null,
        ai_tone: f.ai_tone || null,
        payment_methods: f.payment_methods.split(",").map((x) => x.trim()).filter(Boolean),
        onboarding_completed: true,
      }).eq("id", orgId);
      if (error) throw error;
      // Products: one per line, "Nome - 99,90"
      const rows = f.products.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
        const [name, price] = l.split(/\s+-\s+/);
        return { organization_id: orgId!, name: name.trim(), price: Number((price ?? "0").replace(",", ".")) || 0 };
      });
      if (rows.length) {
        const r = await supabase.from("products").insert(rows);
        if (r.error) throw r.error;
      }
      if (f.ai_tone) await supabase.from("agent_configs").update({ tone: f.ai_tone }).eq("organization_id", orgId);
      await qc.invalidateQueries({ queryKey: ["membership"] });
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-2xl p-8 shadow-soft">
        <h1 className="text-2xl font-semibold">Vamos configurar sua empresa</h1>
        <p className="mt-1 text-sm text-muted-foreground">Essas informações alimentam seu CRM e o agente de IA.</p>
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Nome da empresa *</Label><Input value={f.name} onChange={set("name")} placeholder={m.data?.org.name} /></div>
          <div className="space-y-1.5"><Label>Segmento</Label><Input value={f.segment} onChange={set("segment")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Descrição</Label><Textarea value={f.description} onChange={set("description")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Produtos/serviços e preços</Label><Textarea value={f.products} onChange={set("products")} placeholder={"Um por linha: Nome - 99,90"} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Formas de pagamento</Label><Input value={f.payment_methods} onChange={set("payment_methods")} placeholder="Pix, Cartão, Boleto" /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Políticas (troca, entrega...)</Label><Textarea value={f.policies} onChange={set("policies")} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label>Tom de voz da IA</Label><Input value={f.ai_tone} onChange={set("ai_tone")} placeholder="Amigável e consultivo" /></div>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Concluir</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

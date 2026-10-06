export interface ValidationResult {
  valid: boolean;
  issues: string[];
  checks: Record<string, boolean>;
}

function moneyValues(text: string): number[] {
  return [...text.matchAll(/R\$\s*([0-9]+(?:[.,][0-9]{1,2})?)/gi)].map((m) => {
    const raw = (m[1] ?? "0").trim();
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
    return Number(normalized);
  });
}

export function validateResponse(args: {
  response: string;
  products: Array<{ id: string; name: string; price: number; promo_price?: number | null; stock?: number | null; status: string }>;
  knowledge: Array<{ kind: string; title: string; content: string }>;
  agent: { words_to_avoid?: string[] | null };
  company?: { payment_methods?: string[] | null; policies?: string | null };
  intent: string;
  customerRequestedHuman: boolean;
}): ValidationResult {
  const response = args.response.trim();
  const lower = response.toLowerCase();
  const issues: string[] = [];

  const knownPrices = new Set(
    args.products.flatMap((p) => [Number(p.price), p.promo_price == null ? null : Number(p.promo_price)]).filter(
      (v): v is number => typeof v === "number" && Number.isFinite(v)
    )
  );
  const priceCheck = moneyValues(response).every((value) => knownPrices.has(value));

  if (!priceCheck) issues.push("A resposta contém preço não encontrado no catálogo.");
  const forbidden = (args.agent.words_to_avoid ?? []).filter((word) => word && lower.includes(word.toLowerCase()));
  const toneCheck = forbidden.length === 0;
  if (!toneCheck) issues.push(`A resposta contém palavra proibida: ${forbidden.join(", ")}`);

  const availabilityClaim = /\b(dispon[ií]vel|tem estoque|em estoque|temos estoque|disponibilidade)\b/i.test(response);
  const mentionedProducts = args.products.filter((p) => p.name && lower.includes(p.name.toLowerCase()));
  const availabilityCheck = !availabilityClaim || (
    mentionedProducts.length > 0
      ? mentionedProducts.every((p) => p.status === "ACTIVE" && (p.stock === null || Number(p.stock) > 0))
      : args.products.some((p) => p.status === "ACTIVE" && (p.stock === null || Number(p.stock) > 0))
  );
  if (!availabilityCheck) issues.push("A resposta afirma disponibilidade sem estoque confirmado.");

  const policyClaim = /\b(troca|garantia|entrega|pagamento|cancelamento|reembolso|prazo)\b/i.test(response);
  const policySource = args.knowledge.some((k) =>
    ["POLICY","RULE","FAQ"].includes(k.kind) && k.content.trim().length > 0
  );
  const companySource = Boolean(
    args.company?.policies?.trim() ||
    (args.company?.payment_methods?.length ?? 0) > 0
  );
  const policyCheck = !policyClaim || policySource || companySource;
  if (!policyCheck) issues.push("A resposta aborda política sem fonte de conhecimento correspondente.");

  const promiseCheck = !/\b(garanto|com certeza vai|vou te enviar|vou reservar|prometo)\b/i.test(response);
  if (!promiseCheck) issues.push("A resposta contém promessa operacional não suportada.");

  const humanCheck = !args.customerRequestedHuman || /\b(humano|atendente|especialista|equipe)\b/i.test(response);
  if (!humanCheck) issues.push("Pedido explícito de humano não foi tratado como transferência.");

  const intentCheck = response.length > 0;
  if (!intentCheck) issues.push("Resposta vazia.");

  return {
    valid: issues.length === 0,
    issues,
    checks: {
      product: true,
      price: priceCheck,
      availability: availabilityCheck,
      policy: policyCheck,
      promise: promiseCheck,
      tone: toneCheck,
      intent: intentCheck,
      security: humanCheck,
    },
  };
}

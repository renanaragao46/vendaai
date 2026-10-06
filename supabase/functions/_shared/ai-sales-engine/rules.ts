import type { Intent, SalesStage, Temperature } from "./types.ts";

export function inferTemperature(intent: Intent, text: string): Temperature {
  const value = text.toLowerCase();
  if (
    ["purchase_intent","payment","discount","availability","negotiation"].includes(intent) ||
    /\b(quero comprar|vou comprar|como pago|pix|cart[aã]o|checkout|link para comprar|preciso hoje|agora)\b/i.test(value)
  ) return "HOT";
  if (
    ["product_question","price_question","comparison","objection"].includes(intent) ||
    /\b(quero saber|detalhes|benef[ií]cios|compara|vale a pena|caro|barato)\b/i.test(value)
  ) return "WARM";
  return "COLD";
}

export function nextStage(current: SalesStage, intent: Intent, temperature: Temperature): SalesStage {
  if (intent === "human_request" || intent === "complaint") return current;
  if (intent === "purchase_intent" || intent === "payment") return "CHECKOUT";
  if (intent === "negotiation" || intent === "discount") return "NEGOTIATION";
  if (intent === "objection") return "OBJECTION";
  if (["product_question","price_question","availability","delivery","comparison"].includes(intent)) {
    return current === "NEW" || current === "QUALIFYING" ? "INTERESTED" : "PRODUCT_PRESENTED";
  }
  if (temperature === "HOT" && current === "INTERESTED") return "CHECKOUT";
  if (current === "NEW") return "QUALIFYING";
  return current;
}

export function actionFor(intent: Intent, stage: SalesStage): string {
  if (intent === "human_request" || intent === "complaint") return "HANDOFF_HUMAN";
  if (intent === "purchase_intent" || stage === "CHECKOUT") return "CHECKOUT";
  if (intent === "objection") return "HANDLE_OBJECTION";
  if (intent === "product_question" || intent === "comparison") return "RECOMMEND_PRODUCT";
  if (intent === "price_question") return "ANSWER_PRICE";
  if (intent === "payment") return "ANSWER_PAYMENT";
  if (intent === "delivery") return "ANSWER_DELIVERY";
  if (intent === "support" || intent === "post_sale") return "SUPPORT";
  return "QUALIFY";
}

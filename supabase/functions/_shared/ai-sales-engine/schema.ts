export const AI_SALES_OUTPUT_SCHEMA = {
  intent: "one of the configured VendaAI intents",
  confidence: "0..1",
  response: "grounded commercial response",
  identified_product_id: "product id or null",
  next_action: "next commercial action",
  needs_human: "boolean",
  customer_memory: {
    name: "string or null",
    preferences: "array of voluntary preferences",
    products_of_interest: "array of product ids",
    objections: "array of objections",
    voluntarily_provided: "key/value facts voluntarily provided by customer",
    conversation_summary: "short summary or null"
  }
} as const;

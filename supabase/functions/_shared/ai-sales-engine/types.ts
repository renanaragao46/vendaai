export const INTENTS = [
  "greeting","product_question","price_question","availability","delivery","payment","discount",
  "comparison","objection","purchase_intent","negotiation","support","complaint","human_request",
  "post_sale","unknown",
] as const;
export type Intent = typeof INTENTS[number];

export const SALES_STAGES = [
  "NEW","QUALIFYING","INTERESTED","PRODUCT_PRESENTED","OBJECTION","NEGOTIATION",
  "CHECKOUT","PURCHASED","POST_SALE","LOST",
] as const;
export type SalesStage = typeof SALES_STAGES[number];
export type Temperature = "COLD" | "WARM" | "HOT";
export type AIState = "AI_ACTIVE" | "HUMAN_ACTIVE";

export interface EngineInput {
  organization_id: string;
  conversation_id?: string;
  message?: string;
}

export interface EngineResult {
  status: "success" | "pending_configuration" | "handoff" | "validation_failed" | "error";
  conversation_id: string;
  message_id?: string;
  ai_message_id?: string;
  response?: string;
  intent?: Intent;
  confidence?: number;
  temperature?: Temperature;
  sales_stage?: SalesStage;
  identified_product_id?: string | null;
  next_action?: string;
  reason?: string;
  validation?: Record<string, unknown>;
}

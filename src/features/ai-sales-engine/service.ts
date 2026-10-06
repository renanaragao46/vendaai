import { supabase } from "@/integrations/supabase/client";

export type EngineResponse = {
  status: "success" | "pending_configuration" | "handoff" | "validation_failed" | "error";
  conversation_id: string;
  response?: string;
  intent?: string;
  confidence?: number;
  temperature?: "COLD" | "WARM" | "HOT";
  sales_stage?: string;
  identified_product_id?: string | null;
  next_action?: string;
  reason?: string;
  validation?: Record<string, unknown>;
};

export async function runSalesEngine(input: {
  organization_id: string;
  conversation_id?: string;
  message: string;
}): Promise<EngineResponse> {
  const { data, error } = await supabase.functions.invoke("ai-sales-engine", {
    body: input,
  });
  if (error) throw error;
  return data as EngineResponse;
}

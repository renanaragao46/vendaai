import { buildDynamicInstructions } from "./prompt.ts";
import { actionFor, inferTemperature, nextStage } from "./rules.ts";
import { validateResponse } from "./validator.ts";
import type { Intent, SalesStage, Temperature } from "./types.ts";

const INTENTS = ["greeting","product_question","price_question","availability","delivery","payment","discount","comparison","objection","purchase_intent","negotiation","support","complaint","human_request","post_sale","unknown"] as const;

const outputSchema = {
  type: "json_schema",
  name: "vendaai_sales_decision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intent: { type: "string", enum: [...INTENTS] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      response: { type: "string" },
      identified_product_id: { type: ["string","null"] },
      next_action: { type: "string" },
      needs_human: { type: "boolean" },
      customer_memory: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: ["string","null"] },
          preferences: { type: "array", items: { type: "string" } },
          products_of_interest: { type: "array", items: { type: "string" } },
          objections: { type: "array", items: { type: "string" } },
          voluntarily_provided: { type: "object", additionalProperties: { type: "string" } },
          conversation_summary: { type: ["string","null"] }
        },
        required: ["name","preferences","products_of_interest","objections","voluntarily_provided","conversation_summary"]
      }
    },
    required: ["intent","confidence","response","identified_product_id","next_action","needs_human","customer_memory"]
  }
};

type Decision = {
  intent: Intent;
  confidence: number;
  response: string;
  identified_product_id: string | null;
  next_action: string;
  needs_human: boolean;
  customer_memory: {
    name: string | null;
    preferences: string[];
    products_of_interest: string[];
    objections: string[];
    voluntarily_provided: Record<string,string>;
    conversation_summary: string | null;
  };
};

async function openAI(model: string, instructions: string, customerMessage: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) return { configured: false as const };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      instructions,
      input: [{ role: "user", content: [{ type: "input_text", text: `<customer_message>\n${customerMessage}\n</customer_message>` }] }],
      text: { format: outputSchema },
      store: false,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? "Falha no provedor de IA");
  const raw = payload?.output_text;
  if (typeof raw !== "string" || !raw.trim()) throw new Error("O provedor não retornou uma decisão estruturada.");
  return { configured: true as const, decision: JSON.parse(raw) as Decision, model: payload.model ?? model };
}

export type SalesEngineInput = {
  db: any;
  organizationId: string;
  conversationId?: string | null;
  contactId?: string | null;
  channel?: "SIMULATOR" | "WHATSAPP";
  customerMessage: string;
  actorUserId?: string | null;
};

export async function runSalesEngine(input: SalesEngineInput) {
  const { db, organizationId } = input;
  const started = Date.now();
  let runId: string | null = null;

  const { data: org, error: orgError } = await db.from("organizations").select("*").eq("id", organizationId).single();
  const { data: agent, error: agentError } = await db.from("agent_configs").select("*").eq("organization_id", organizationId).single();
  if (orgError || agentError || !org || !agent) throw new Error("Configuração da organização/agente não encontrada.");

  let conversationId = input.conversationId ?? null;
  if (conversationId) {
    const { data: existing } = await db.from("conversations").select("*").eq("id", conversationId).eq("organization_id", organizationId).single();
    if (!existing) throw new Error("Conversa não encontrada.");
    if (existing.ai_state === "HUMAN_ACTIVE") {
      return { status: "handoff" as const, conversation_id: conversationId, reason: "CONVERSA_EM_ATENDIMENTO_HUMANO" };
    }
  } else {
    const { data: created, error } = await db.from("conversations").insert({
      organization_id: organizationId,
      contact_id: input.contactId ?? null,
      channel: input.channel ?? "SIMULATOR",
      status: "OPEN",
      ai_state: "AI_ACTIVE",
      sales_stage: "NEW",
      temperature: "COLD",
      last_message_at: new Date().toISOString(),
    }).select().single();
    if (error || !created) throw error ?? new Error("Não foi possível criar a conversa.");
    conversationId = created.id;
  }

  const { data: conversation } = await db.from("conversations").select("*").eq("id", conversationId).eq("organization_id", organizationId).single();
  if (!conversation) throw new Error("Contexto da conversa não encontrado.");

  const { data: incoming, error: incomingError } = await db.from("messages").insert({
    organization_id: organizationId,
    conversation_id: conversationId,
    sender_type: "CUSTOMER",
    message_type: input.channel === "WHATSAPP" && input.customerMessage.startsWith("[AUDIO]") ? "AUDIO" : "TEXT",
    content: input.customerMessage,
    status: "SENT",
    metadata: { channel: input.channel ?? "SIMULATOR" },
  }).select().single();
  if (incomingError || !incoming) throw incomingError ?? new Error("Não foi possível salvar a mensagem.");

  const { data: recentMessages } = await db.from("messages")
    .select("sender_type,message_type,content,created_at")
    .eq("organization_id", organizationId).eq("conversation_id", conversationId)
    .order("created_at", { ascending: false }).limit(20);

  const contactId = (conversation.contact_id as string | null) ?? input.contactId ?? null;
  const [{ data: memory }, { data: products }, { data: knowledge }, { data: orders }] = await Promise.all([
    contactId ? db.from("customer_memories").select("*").eq("organization_id", organizationId).eq("contact_id", contactId).maybeSingle() : Promise.resolve({ data: null }),
    db.from("products").select("id,name,description,price,promo_price,benefits,features,stock,status,checkout_url,category_id").eq("organization_id", organizationId).eq("status","ACTIVE").order("name").limit(100),
    db.from("knowledge_items").select("kind,title,content").eq("organization_id", organizationId).order("updated_at",{ascending:false}).limit(100),
    contactId ? db.from("orders").select("id,status,total_amount,currency,paid_at,created_at").eq("organization_id",organizationId).eq("contact_id",contactId).order("created_at",{ascending:false}).limit(10) : Promise.resolve({ data: [] }),
  ]);

  const businessRules = (knowledge ?? []).filter((item: any) => ["POLICY","RULE","OBJECTION"].includes(item.kind));
  const promptInstructions = buildDynamicInstructions({
    company: { name: org.name, segment: org.segment, description: org.description, payment_methods: org.payment_methods, policies: org.policies, ai_tone: org.ai_tone },
    agent: {
      name: agent.agent_name, personality: agent.personality, tone: agent.tone, emoji_usage: agent.emoji_usage,
      primary_objective: agent.primary_objective, target_audience: agent.target_audience,
      language_rules: agent.language_rules, words_to_use: agent.words_to_use, words_to_avoid: agent.words_to_avoid,
    },
    businessRules,
    products: products ?? [],
    knowledge: knowledge ?? [],
    memory: memory ?? { name: null, preferences: [], products_of_interest: [], objections: [], purchase_history: orders ?? [], voluntarily_provided: {}, conversation_summary: null },
    conversationSummary: conversation.summary,
    recentMessages: [...(recentMessages ?? [])].reverse(),
    currentStage: conversation.sales_stage as SalesStage,
    temperature: conversation.temperature as Temperature,
    objective: agent.primary_objective,
  });

  const { data: runRow, error: runError } = await db.from("ai_runs").insert({
    organization_id: organizationId,
    conversation_id: conversationId,
    message_id: incoming.id,
    result: "PENDING",
    provider: agent.llm_provider,
    model: agent.llm_model,
    metadata: { pipeline: ["MESSAGE_RECEIVED","IDENTIFY_CONTACT","LOAD_CONVERSATION_CONTEXT","LOAD_CUSTOMER_MEMORY","CLASSIFY_INTENT","LOAD_COMPANY_KNOWLEDGE","LOAD_PRODUCTS","LOAD_SALES_CONTEXT","DETERMINE_LEAD_TEMPERATURE","DETERMINE_SALES_STAGE","DETERMINE_NEXT_ACTION","GENERATE_RESPONSE","VALIDATE_RESPONSE","SAVE_AI_RUN","SAVE_AI_ACTION"] },
  }).select("id").single();
  if (runError || !runRow) throw runError ?? new Error("Não foi possível registrar AI run.");
  runId = runRow.id;

  if (!agent.is_active) {
    await db.from("ai_runs").update({
      result:"PENDING_CONFIGURATION",
      duration_ms:Date.now()-started,
      error:"Agente IA está desativado."
    }).eq("id",runId).eq("organization_id",organizationId);
    await db.from("ai_actions").insert({
      organization_id:organizationId,
      ai_run_id:runId,
      conversation_id:conversationId,
      action_type:"PENDING_CONFIGURATION",
      status:"SELECTED",
      payload:{ message:"Agente IA está desativado." }
    });
    return {
      status:"pending_configuration" as const,
      conversation_id:conversationId,
      reason:"O agente de IA está desativado."
    };
  }

  if (agent.llm_provider !== "openai") {
    await db.from("ai_runs").update({ result:"PENDING_CONFIGURATION", duration_ms:Date.now()-started, error:"Provedor não suportado nesta versão." }).eq("id",runId).eq("organization_id",organizationId);
    return { status:"pending_configuration" as const, conversation_id:conversationId, reason:"Configuração de IA pendente" };
  }

  let ai: Awaited<ReturnType<typeof openAI>>;
  try {
    ai = await openAI(agent.llm_model, promptInstructions, input.customerMessage.replace(/^\[AUDIO\]\s*/i, ""));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no provedor de IA.";
    await db.from("ai_runs").update({
      result:"ERROR",
      duration_ms:Date.now()-started,
      error:message
    }).eq("id",runId).eq("organization_id",organizationId);
    await db.from("ai_actions").insert({
      organization_id:organizationId,
      ai_run_id:runId,
      conversation_id:conversationId,
      action_type:"LLM_ERROR",
      status:"FAILED",
      payload:{ error:message }
    });
    throw error;
  }

  if (!ai.configured) {
    await db.from("ai_runs").update({ result:"PENDING_CONFIGURATION", duration_ms:Date.now()-started, error:"OPENAI_API_KEY não configurada." }).eq("id",runId).eq("organization_id",organizationId);
    await db.from("ai_actions").insert({ organization_id:organizationId, ai_run_id:runId, conversation_id:conversationId, action_type:"PENDING_CONFIGURATION", status:"SELECTED", payload:{ message:"Configuração de IA pendente" } });
    return { status:"pending_configuration" as const, conversation_id:conversationId, reason:"Configuração de IA pendente" };
  }

  const decision = ai.decision;
  const temperature = inferTemperature(decision.intent, input.customerMessage);
  const stage = nextStage(conversation.sales_stage as SalesStage, decision.intent, temperature);
  const action = actionFor(decision.intent, stage);
  const validation = validateResponse({
    response: decision.response,
    products: (products ?? []).map((p:any) => ({ id:p.id,name:p.name,price:Number(p.price),promo_price:p.promo_price == null ? null : Number(p.promo_price),stock:p.stock,status:p.status })),
    knowledge: knowledge ?? [],
    agent,
    intent: decision.intent,
    customerRequestedHuman: decision.intent === "human_request" || decision.needs_human,
  });

  const lowConfidence = decision.confidence < 0.65;
  const needsHuman = decision.needs_human || decision.intent === "human_request" || decision.intent === "complaint" || lowConfidence || !validation.valid;
  const finalResult = needsHuman ? (validation.valid ? "HANDOFF" : "VALIDATION_FAILED") : "SUCCESS";

  await db.from("ai_runs").update({
    intent:decision.intent, confidence:decision.confidence, sales_stage:stage, temperature,
    action:needsHuman ? "HANDOFF_HUMAN" : action, generated_response:needsHuman ? null : decision.response,
    duration_ms:Date.now()-started, result:finalResult, provider:agent.llm_provider, model:ai.model,
    validation, metadata:{ identified_product_id:decision.identified_product_id },
  }).eq("id",runId).eq("organization_id",organizationId);

  await db.from("ai_actions").insert({
    organization_id:organizationId, ai_run_id:runId, conversation_id:conversationId,
    action_type:needsHuman ? "HANDOFF_HUMAN" : action, status:"SELECTED",
    payload:{ intent:decision.intent, confidence:decision.confidence, validation, identified_product_id:decision.identified_product_id },
  });

  if (conversation.sales_stage !== stage || conversation.temperature !== temperature) {
    await db.from("sales_stage_history").insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      from_stage: conversation.sales_stage,
      to_stage: stage,
      from_temperature: conversation.temperature,
      to_temperature: temperature,
      reason: `Intento identificado: ${decision.intent}`,
    });
  }

  await db.from("conversations").update({
    sales_stage:stage, temperature, summary:decision.customer_memory.conversation_summary ?? conversation.summary,
    last_message_at:new Date().toISOString(), ai_state:needsHuman ? "HUMAN_ACTIVE" : "AI_ACTIVE",
  }).eq("id",conversationId).eq("organization_id",organizationId);

  if (needsHuman) {
    await db.from("conversation_handoffs").insert({
      organization_id:organizationId, conversation_id:conversationId,
      reason:decision.needs_human ? "IA solicitou transferência" : (!validation.valid ? "Falha na validação da resposta" : "Baixa confiança ou reclamação"),
      status:"OPEN", created_by:input.actorUserId ?? null,
    });
    return { status: finalResult === "VALIDATION_FAILED" ? "validation_failed" as const : "handoff" as const, conversation_id:conversationId, intent:decision.intent, confidence:decision.confidence, temperature, sales_stage:stage, next_action:"HANDOFF_HUMAN", validation, reason:"Conversa transferida para atendimento humano." };
  }

  const { data: aiMessage, error: aiMessageError } = await db.from("messages").insert({
    organization_id:organizationId, conversation_id:conversationId, sender_type:"AI", message_type:"TEXT",
    content:decision.response, status:"SENT", metadata:{ ai_run_id:runId, intent:decision.intent, confidence:decision.confidence },
  }).select().single();
  if (aiMessageError || !aiMessage) throw aiMessageError ?? new Error("Não foi possível salvar a resposta da IA.");

  if (contactId) {
    const existingPreferences = Array.isArray(memory?.preferences) ? memory.preferences : [];
    const existingObjections = Array.isArray(memory?.objections) ? memory.objections : [];
    await db.from("customer_memories").upsert({
      organization_id:organizationId, contact_id:contactId,
      name:decision.customer_memory.name ?? memory?.name ?? null,
      preferences:[...new Set([...existingPreferences, ...decision.customer_memory.preferences])],
      products_of_interest:decision.customer_memory.products_of_interest ?? memory?.products_of_interest ?? [],
      objections:[...new Set([...existingObjections, ...decision.customer_memory.objections])],
      purchase_history:orders ?? memory?.purchase_history ?? [],
      last_interaction_at:new Date().toISOString(), sales_stage:stage, temperature,
      voluntarily_provided:{ ...(memory?.voluntarily_provided ?? {}), ...decision.customer_memory.voluntarily_provided },
      conversation_summary:decision.customer_memory.conversation_summary ?? conversation.summary,
    }, { onConflict:"organization_id,contact_id" });
  }

  return {
    status:"success" as const, conversation_id:conversationId, message_id:incoming.id, ai_message_id:aiMessage.id,
    response:decision.response, intent:decision.intent, confidence:decision.confidence,
    temperature, sales_stage:stage, identified_product_id:decision.identified_product_id,
    next_action:action, validation,
  };
};

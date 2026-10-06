import { describe, expect, it } from "vitest";
import { validateResponse } from "./validator.ts";

const base = {
  products: [
    {
      id: "p1",
      name: "Plano Premium",
      price: 1234.56,
      promo_price: 999.9,
      stock: 5,
      status: "ACTIVE",
    },
  ],
  knowledge: [],
  agent: { words_to_avoid: [] },
  intent: "price_question",
  customerRequestedHuman: false,
};

describe("AI response validator", () => {
  it("accepts catalog prices written in Brazilian currency format", () => {
    const result = validateResponse({
      ...base,
      response: "O Plano Premium está por R$ 1.234,56.",
      identifiedProductId: "p1",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects prices that do not exist in the catalog", () => {
    const result = validateResponse({
      ...base,
      response: "O Plano Premium está por R$ 899,00.",
    });
    expect(result.valid).toBe(false);
    expect(result.checks.price).toBe(false);
  });

  it("rejects availability claims for an out-of-stock product", () => {
    const result = validateResponse({
      ...base,
      products: [{ ...base.products[0], stock: 0 }],
      response: "O Plano Premium está disponível.",
    });
    expect(result.valid).toBe(false);
    expect(result.checks.availability).toBe(false);
  });

  it("accepts policy claims when company policy is configured", () => {
    const result = validateResponse({
      ...base,
      response: "Aceitamos Pix e cartão.",
      company: { payment_methods: ["PIX", "CARD"], policies: null },
      intent: "payment",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a product id that is not in the catalog", () => {
    const result = validateResponse({
      ...base,
      response: "Vou verificar isso para você.",
      identifiedProductId: "unknown",
    });
    expect(result.valid).toBe(false);
    expect(result.checks.product).toBe(false);
  });

  it("rejects unsupported operational promises", () => {
    const result = validateResponse({
      ...base,
      response: "Prometo que vou reservar seu produto.",
    });
    expect(result.valid).toBe(false);
    expect(result.checks.promise).toBe(false);
  });
});

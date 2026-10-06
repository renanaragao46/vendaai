import { describe, expect, it } from "vitest";
import { actionFor, inferTemperature, nextStage } from "./rules.ts";

describe("sales rules", () => {
  it("classifies purchase intent as hot", () => {
    expect(inferTemperature("purchase_intent", "quero comprar agora")).toBe("HOT");
  });

  it("moves a new customer with a product question into interest", () => {
    expect(nextStage("NEW", "product_question", "WARM")).toBe("INTERESTED");
  });

  it("sends checkout intent to checkout", () => {
    expect(nextStage("INTERESTED", "purchase_intent", "HOT")).toBe("CHECKOUT");
    expect(actionFor("purchase_intent", "CHECKOUT")).toBe("CHECKOUT");
  });

  it("keeps complaints available for human handling", () => {
    expect(actionFor("complaint", "INTERESTED")).toBe("HANDOFF_HUMAN");
  });
});

import { describe, expect, it, vi } from "vitest";
import { resolveGoldenEvaluationInput } from "./golden-evaluations.js";

describe("resolveGoldenEvaluationInput", () => {
  it("shares provider options and task defaults without overriding task values", () => {
    const answer = { provider: "callback" as const, run: vi.fn() };
    const resolved = resolveGoldenEvaluationInput({
      surface: "configured-search",
      allowNetwork: true,
      searchTimeoutMs: 2_500,
      answer,
      tokenBudget: 4_000,
      topK: 5,
      tasks: [
        { id: "defaults", query: "default budgets", expect: {} },
        { id: "overrides", query: "custom budgets", tokenBudget: 2_000, topK: 2, expect: {} },
      ],
    });

    expect(resolved.options).toEqual({
      surface: "configured-search",
      allowNetwork: true,
      searchTimeoutMs: 2_500,
      answer,
    });
    expect(resolved.tasks).toEqual([
      {
        id: "defaults",
        query: "default budgets",
        expect: {},
        tokenBudget: 4_000,
        topK: 5,
      },
      {
        id: "overrides",
        query: "custom budgets",
        expect: {},
        tokenBudget: 2_000,
        topK: 2,
      },
    ]);
  });

  it("keeps disabled and malformed runtime inputs distinguishable", () => {
    expect(
      resolveGoldenEvaluationInput({
        enabled: false,
        allowNetwork: true,
        tasks: [{ id: "ignored" }],
      }),
    ).toEqual({
      tasks: undefined,
      options: {
        surface: undefined,
        allowNetwork: true,
        searchTimeoutMs: undefined,
        answer: undefined,
      },
    });

    expect(resolveGoldenEvaluationInput({ tasks: "not-an-array" }).tasks).toBe("not-an-array");
    expect(resolveGoldenEvaluationInput("not-an-object").tasks).toEqual({
      evaluationConfig: "not-an-object",
    });
  });
});

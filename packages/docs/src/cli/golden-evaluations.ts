import type { DocsGoldenTask, RunDocsGoldenTasksOptions } from "../agent-evals.js";

type GoldenEvaluationOptions = Pick<
  RunDocsGoldenTasksOptions,
  "surface" | "allowNetwork" | "searchTimeoutMs" | "answer"
>;

export interface ResolvedGoldenEvaluationInput {
  tasks: readonly DocsGoldenTask[] | undefined;
  options: GoldenEvaluationOptions;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Normalize the runtime docs.config evaluation shape shared by doctor and review. */
export function resolveGoldenEvaluationInput(
  evaluationInput: unknown,
): ResolvedGoldenEvaluationInput {
  if (evaluationInput === undefined || typeof evaluationInput === "boolean") {
    return { tasks: undefined, options: {} };
  }
  if (!isPlainRecord(evaluationInput)) {
    return {
      tasks: { evaluationConfig: evaluationInput } as unknown as readonly DocsGoldenTask[],
      options: {},
    };
  }

  const options = {
    surface: evaluationInput.surface,
    allowNetwork: evaluationInput.allowNetwork,
    searchTimeoutMs: evaluationInput.searchTimeoutMs,
    answer: evaluationInput.answer,
  } as GoldenEvaluationOptions;
  if (evaluationInput.enabled === false) return { tasks: undefined, options };
  if ("enabled" in evaluationInput && typeof evaluationInput.enabled !== "boolean") {
    return {
      tasks: evaluationInput as unknown as readonly DocsGoldenTask[],
      options,
    };
  }
  if (!("tasks" in evaluationInput)) return { tasks: undefined, options };

  const runtimeTasks = evaluationInput.tasks;
  if (!Array.isArray(runtimeTasks)) {
    return { tasks: runtimeTasks as readonly DocsGoldenTask[], options };
  }

  return {
    tasks: runtimeTasks.map((task) => {
      if (!isPlainRecord(task)) return task;
      return {
        ...task,
        tokenBudget: task.tokenBudget ?? evaluationInput.tokenBudget,
        topK: task.topK ?? evaluationInput.topK,
      };
    }) as readonly DocsGoldenTask[],
    options,
  };
}

import type { PageActionsConfig } from "@farming-labs/docs";

export interface ResolvedTocPageActions {
  copyMarkdown: boolean;
  viewMarkdown: boolean;
  editOnGitHub: boolean;
}

/** Resolve `pageActions.toc` to the actions shown in the table-of-contents rail. */
export function resolveTocPageActions(
  toc: PageActionsConfig["toc"],
): ResolvedTocPageActions | undefined {
  if (!toc) return undefined;
  const picked = toc === true ? {} : toc;
  return {
    copyMarkdown: picked.copyMarkdown !== false,
    viewMarkdown: picked.viewMarkdown !== false,
    editOnGitHub: picked.editOnGitHub !== false,
  };
}

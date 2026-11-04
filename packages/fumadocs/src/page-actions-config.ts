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

export interface ResolvedPageActionDescriptions {
  copyMarkdown: string;
  viewMarkdown: string;
  connectMcp: string;
}

export const DEFAULT_PAGE_ACTION_DESCRIPTIONS: ResolvedPageActionDescriptions = {
  copyMarkdown: "Markdown, ready to paste into an LLM",
  viewMarkdown: "This page as plain text",
  connectMcp: "Use these docs from any MCP client",
};

/** Resolve `pageActions.descriptions` to the texts under each page actions menu item. */
export function resolvePageActionDescriptions(
  descriptions: PageActionsConfig["descriptions"],
): ResolvedPageActionDescriptions | undefined {
  if (!descriptions) return undefined;
  const picked = descriptions === true ? {} : descriptions;
  return {
    copyMarkdown: picked.copyMarkdown ?? DEFAULT_PAGE_ACTION_DESCRIPTIONS.copyMarkdown,
    viewMarkdown: picked.viewMarkdown ?? DEFAULT_PAGE_ACTION_DESCRIPTIONS.viewMarkdown,
    connectMcp: picked.connectMcp ?? DEFAULT_PAGE_ACTION_DESCRIPTIONS.connectMcp,
  };
}

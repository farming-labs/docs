"use client";

import { createContext, useContext, type ReactNode } from "react";

/** Where an MDX pipeline placed a title slot, relative to the page's own h1. */
export type DocsTitleSlotPosition = "title" | "description";

interface DocsTitleSlotValue {
  position: DocsTitleSlotPosition;
  content: ReactNode;
}

export const DocsTitleSlotContext = createContext<DocsTitleSlotValue | null>(null);

/**
 * Renders the page description and below-title block where the MDX pipeline
 * placed it: right after the page's h1, or after the description paragraph when
 * the body already starts with it. The page renders it on the server, so the
 * block no longer waits for hydration to be moved under the title.
 */
export function DocsTitleSlot({ position }: { position?: DocsTitleSlotPosition }) {
  const value = useContext(DocsTitleSlotContext);
  if (!value || value.position !== position) return null;

  return (
    <div className="fd-title-decorations-host" data-fd-title-slot="">
      {value.content}
    </div>
  );
}

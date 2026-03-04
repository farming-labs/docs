"use client";

import * as React from "react";
import type { CodeBlockCopyData } from "@farming-labs/docs";

type PreProps = React.ComponentPropsWithoutRef<"pre">;

/**
 * Creates a wrapper around the default MDX `pre` component that calls
 * `onCopyClick` when the user clicks the code block's copy button.
 * The actual copy-to-clipboard is still done by the default component.
 */
export function createPreWithCopyCallback(
  DefaultPre: React.ComponentType<PreProps> | "pre",
  onCopyClick?: (data: CodeBlockCopyData) => void,
): React.ComponentType<PreProps> {
  if (!onCopyClick) {
    return typeof DefaultPre === "string" ? DefaultPre : DefaultPre;
  }

  function PreWithCopyCallback(props: PreProps) {
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
      const wrapper = ref.current;
      if (!wrapper) return;
      const figure = wrapper.closest("figure");
      if (!figure) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.closest?.("button")) return;
        const pre = figure.querySelector("pre");
        const code = pre?.querySelector("code");
        if (!code) return;
        const content = code.textContent ?? "";
        const url = typeof window !== "undefined" ? window.location.href : "";
        const language =
          code.getAttribute("data-language") ?? figure.getAttribute("data-language") ?? undefined;
        const title =
          figure.querySelector("[data-title]")?.textContent?.trim() ??
          (figure.querySelector(".fd-codeblock-title-text") as HTMLElement)?.textContent?.trim() ??
          undefined;
        onCopyClick({ title, content, url, language });
      };

      figure.addEventListener("click", handleClick, true);
      return () => figure.removeEventListener("click", handleClick, true);
    }, [onCopyClick]);

    const Pre = DefaultPre;
    return (
      <div ref={ref} data-fd-copy-wrapper style={{ display: "contents" }}>
        {typeof Pre === "string" ? (
          <pre {...(props as React.HTMLAttributes<HTMLPreElement>)} />
        ) : (
          <Pre {...props} />
        )}
      </div>
    );
  }

  return PreWithCopyCallback;
}

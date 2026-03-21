"use client";

import { useEffect } from "react";
import type { CodeBlockCopyData, DocsFeedbackData } from "@farming-labs/docs";

type CopyHandler = (data: CodeBlockCopyData) => void;
type FeedbackHandler = (data: DocsFeedbackData) => void | Promise<void>;

interface DocsWindowHooks extends Window {
  __fdOnCopyClick__?: CopyHandler;
  __fdOnFeedback__?: FeedbackHandler;
}

function useWindowHook<K extends keyof DocsWindowHooks>(key: K, handler: DocsWindowHooks[K]) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof handler !== "function") return;

    const target = window as DocsWindowHooks;
    const previous = target[key];
    target[key] = handler;

    return () => {
      if (target[key] === handler) {
        if (typeof previous === "function") {
          target[key] = previous;
        } else {
          delete target[key];
        }
      }
    };
  }, [handler, key]);
}

export function DocsClientHooks({
  onCopyClick,
  onFeedback,
}: {
  onCopyClick?: CopyHandler;
  onFeedback?: FeedbackHandler;
}) {
  useWindowHook("__fdOnCopyClick__", onCopyClick);
  useWindowHook("__fdOnFeedback__", onFeedback);

  return null;
}

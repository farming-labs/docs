"use client";

import { useMemo, useState } from "react";
import type { DocsFeedbackData, DocsFeedbackValue } from "@farming-labs/docs";

interface DocsWindowHooks extends Window {
  __fdOnFeedback__?: (data: DocsFeedbackData) => void | Promise<void>;
}

export interface DocsFeedbackProps {
  pathname: string;
  entry: string;
  locale?: string;
  question?: string;
  placeholder?: string;
  positiveLabel?: string;
  negativeLabel?: string;
  submitLabel?: string;
  onFeedback?: (data: DocsFeedbackData) => void | Promise<void>;
}

function normalizePathname(pathname: string) {
  return pathname.replace(/\/$/, "") || "/";
}

function resolveSlug(entry: string, pathname: string) {
  const entryParts = entry.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);
  const matchesEntry = pathParts.slice(0, entryParts.length).join("/") === entryParts.join("/");
  const slugParts = matchesEntry ? pathParts.slice(entryParts.length) : pathParts;
  return slugParts.join("/");
}

function readTextContent(selector: string) {
  if (typeof document === "undefined") return undefined;
  const text = document.querySelector(selector)?.textContent?.trim();
  return text && text.length > 0 ? text : undefined;
}

async function emitFeedback(
  data: DocsFeedbackData,
  onFeedback?: (data: DocsFeedbackData) => void | Promise<void>,
) {
  let firstError: unknown;

  try {
    await onFeedback?.(data);
  } catch (error) {
    firstError ??= error;
  }

  if (typeof window === "undefined") {
    if (firstError) throw firstError;
    return;
  }

  try {
    await (window as DocsWindowHooks).__fdOnFeedback__?.(data);
  } catch (error) {
    firstError ??= error;
  }

  window.dispatchEvent(new CustomEvent("fd:feedback", { detail: data }));

  if (firstError) throw firstError;
}

function buildFeedbackPayload(
  value: DocsFeedbackValue,
  pathname: string,
  entry: string,
  comment?: string,
  locale?: string,
): DocsFeedbackData {
  const normalizedPathname = normalizePathname(pathname);
  return {
    value,
    comment: comment?.trim() ? comment.trim() : undefined,
    title: readTextContent(".fd-page-title, h1"),
    description: readTextContent(".fd-page-description"),
    url: typeof window !== "undefined" ? window.location.href : normalizedPathname,
    pathname: normalizedPathname,
    path: normalizedPathname,
    entry,
    slug: resolveSlug(entry, normalizedPathname),
    locale,
  };
}

function ThumbUpIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 21H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2m0 11V10m0 11h9.28a2 2 0 0 0 1.97-1.66l1.2-7A2 2 0 0 0 17.48 10H13V6.5a2.5 2.5 0 0 0-2.5-2.5L7 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M17 3h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2M17 3v11m0-11H7.72a2 2 0 0 0-1.97 1.66l-1.2 7A2 2 0 0 0 6.52 14H11v3.5a2.5 2.5 0 0 0 2.5 2.5L17 14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocsFeedback({
  pathname,
  entry,
  locale,
  question = "How is this guide?",
  placeholder = "Leave your feedback...",
  positiveLabel = "Good",
  negativeLabel = "Bad",
  submitLabel = "Submit",
  onFeedback,
}: DocsFeedbackProps) {
  const [selected, setSelected] = useState<DocsFeedbackValue | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted" | "error">("idle");
  const normalizedPathname = useMemo(() => normalizePathname(pathname), [pathname]);
  const showForm = selected !== null;

  function handleSelect(value: DocsFeedbackValue) {
    setSelected(value);
    if (status !== "idle") setStatus("idle");
  }

  async function handleSubmit() {
    if (!selected || status === "submitting") return;

    setStatus("submitting");

    try {
      await emitFeedback(
        buildFeedbackPayload(selected, normalizedPathname, entry, comment, locale),
        onFeedback,
      );
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="fd-feedback not-prose" aria-label="Page feedback">
      <div className="fd-feedback-content">
        <p className="fd-feedback-question">{question}</p>
        <div className="fd-feedback-actions" role="group" aria-label={question}>
          <button
            type="button"
            className="fd-page-action-btn fd-feedback-choice"
            aria-pressed={selected === "positive"}
            data-selected={selected === "positive" ? "true" : undefined}
            data-feedback-value="positive"
            disabled={status === "submitting"}
            onClick={() => handleSelect("positive")}
          >
            <ThumbUpIcon />
            <span>{positiveLabel}</span>
          </button>
          <button
            type="button"
            className="fd-page-action-btn fd-feedback-choice"
            aria-pressed={selected === "negative"}
            data-selected={selected === "negative" ? "true" : undefined}
            data-feedback-value="negative"
            disabled={status === "submitting"}
            onClick={() => handleSelect("negative")}
          >
            <ThumbDownIcon />
            <span>{negativeLabel}</span>
          </button>
        </div>
      </div>
      {showForm && (
        <div className="fd-feedback-form">
          <textarea
            id="fd-feedback-comment"
            className="fd-feedback-input"
            aria-label="Additional feedback"
            placeholder={placeholder}
            value={comment}
            disabled={status === "submitting"}
            onChange={(event) => {
              setComment(event.target.value);
              if (status !== "idle") setStatus("idle");
            }}
          />
          <div className="fd-feedback-submit-row">
            <button
              type="button"
              className="fd-page-action-btn fd-feedback-submit"
              disabled={status === "submitting" || status === "submitted"}
              onClick={() => void handleSubmit()}
            >
              {status === "submitting" && (
                <span className="fd-feedback-spinner" aria-hidden="true" />
              )}
              {status === "submitted" && <CheckIcon />}
              <span>{status === "submitted" ? "Submitted" : submitLabel}</span>
            </button>
            {status === "submitted" && (
              <p
                className="fd-feedback-status"
                data-status="success"
                role="status"
                aria-live="polite"
              >
                Thanks for the feedback.
              </p>
            )}
          </div>
          {status === "error" && (
            <p className="fd-feedback-status" data-status="error" role="status" aria-live="polite">
              Could not send feedback. Please try again.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

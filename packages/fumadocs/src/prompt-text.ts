import React from "react";

function normalizePromptText(text: string): string {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .split("\n");

  const normalized: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? "";
    const previous = normalized[normalized.length - 1] ?? "";
    let nextNonEmpty = "";

    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor]?.trim() ?? "";
      if (candidate) {
        nextNonEmpty = candidate;
        break;
      }
    }

    if (
      current.trim() === "" &&
      previous.trim().startsWith("- ") &&
      nextNonEmpty.startsWith("- ")
    ) {
      continue;
    }

    normalized.push(current);
  }

  return normalized.join("\n");
}

export function extractPromptText(children: React.ReactNode): string {
  function inner(node: React.ReactNode): string {
    if (node == null || typeof node === "boolean") return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((child) => inner(child)).join("");

    if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
      const childText = inner(node.props.children);

      if (node.type === "br") return "\n";
      if (node.type === "li") return `- ${childText.trim()}\n`;
      if (node.type === "p") return `${childText.trim()}\n\n`;
      if (node.type === "ul" || node.type === "ol") return `${childText.trim()}\n`;

      return childText;
    }

    return "";
  }

  return inner(children)
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function sanitizePromptText(text: string): string {
  return normalizePromptText(text);
}

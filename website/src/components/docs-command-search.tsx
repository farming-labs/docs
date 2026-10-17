"use client";

import * as React from "react";
import { FileText, Hash, Type } from "lucide-react";
import {
  OmniCommandPalette,
  type OmniSource,
  type OmniItem,
} from "@/components/ui/omni-command-palette";

interface SearchResult {
  id: string;
  url: string;
  type: "page" | "heading" | "text";
  content: string;
}

function stripHtml(html: string): string {
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = html;
    return el.textContent || el.innerText || "";
  }
  return html.replace(/<[^>]+>/g, "");
}

function iconForType(type: SearchResult["type"]): React.ReactNode {
  switch (type) {
    case "page":
      return <FileText className="size-4" />;
    case "heading":
      return <Hash className="size-4" />;
    case "text":
      return <Type className="size-4" />;
    default:
      return <FileText className="size-4" />;
  }
}

function labelForType(type: SearchResult["type"]): string {
  switch (type) {
    case "page":
      return "Page";
    case "heading":
      return "Section";
    case "text":
      return "Content";
    default:
      return "Result";
  }
}

const docsSource: OmniSource = {
  id: "docs",
  label: "Documentation",
  minQuery: 1,
  async fetch(query: string) {
    if (!query.trim()) return [];
    try {
      const res = await fetch(`/api/docs?query=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data: SearchResult[] = await res.json();
      return data.map(
        (r): OmniItem => ({
          id: r.id,
          label: stripHtml(r.content),
          subtitle: labelForType(r.type),
          groupId: "docs",
          href: r.url,
          icon: iconForType(r.type),
          keywords: [r.type],
        }),
      );
    } catch {
      return [];
    }
  },
};

export function DocsCommandSearch() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, []);

  React.useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const button = target.closest("button");
      if (!button) return;
      const text = button.textContent || "";
      if (text.includes("Search") && (text.includes("⌘") || text.includes("K"))) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        setOpen(true);
      }
    }
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, []);

  return (
    <OmniCommandPalette
      open={open}
      onOpenChange={setOpen}
      sources={[docsSource]}
      storageKey="docs:omni:recents"
      showRecents
      placeholder="Search documentation…"
      debounceMs={150}
      onItemExecuted={(item) => {
        if (item.href && !item.href.startsWith("http")) {
          window.location.href = item.href;
        }
      }}
    />
  );
}

<script>
  /**
   * ContentRenderer — Renders markdown content as HTML.
   *
   * Converts markdown to HTML at render time with basic syntax support.
   * For production, you'd use mdsvex or a proper markdown parser.
   * This lightweight version handles the most common elements.
   */

  let { content = "" } = $props();

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  }

  let html = $derived.by(() => {
    if (!content) return "";

    let result = content;

    // Code blocks — extract and replace with placeholders to protect from further processing
    const codeBlocks = [];
    result = result.replace(/```([^\n]*)\n([\s\S]*?)```/g, (_, meta, code) => {
      const lang = meta.split(/\s/)[0] || "text";
      const escaped = code
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const placeholder = `%%CODEBLOCK_${codeBlocks.length}%%`;
      codeBlocks.push(`<pre><code class="language-${lang}">${escaped}</code></pre>`);
      return placeholder;
    });

    // Inline code
    result = result.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headings (with IDs for TOC)
    result = result.replace(/^#### (.+)$/gm, (_, text) => {
      const id = slugify(text.replace(/<[^>]+>/g, ""));
      return `<h4 id="${id}">${text}</h4>`;
    });
    result = result.replace(/^### (.+)$/gm, (_, text) => {
      const id = slugify(text.replace(/<[^>]+>/g, ""));
      return `<h3 id="${id}">${text}</h3>`;
    });
    result = result.replace(/^## (.+)$/gm, (_, text) => {
      const id = slugify(text.replace(/<[^>]+>/g, ""));
      return `<h2 id="${id}">${text}</h2>`;
    });
    result = result.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Bold and italic
    result = result.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    result = result.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Links
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Blockquotes
    result = result.replace(/^>\s*(.+)$/gm, "<blockquote><p>$1</p></blockquote>");

    // Horizontal rules
    result = result.replace(/^---$/gm, "<hr />");

    // Tables
    result = result.replace(
      /^\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/gm,
      (_, headerRow, bodyRows) => {
        const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);
        const rows = bodyRows.trim().split("\n").map((row) =>
          row.split("|").map((c) => c.trim()).filter(Boolean)
        );
        const headerHtml = headers.map((h) => `<th>${h}</th>`).join("");
        const rowsHtml = rows
          .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`)
          .join("");
        return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
      }
    );

    // Unordered lists
    result = result.replace(
      /(?:^- .+\n?)+/gm,
      (block) => {
        const items = block
          .split("\n")
          .filter((l) => l.startsWith("- "))
          .map((l) => `<li>${l.slice(2)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
    );

    // Ordered lists
    result = result.replace(
      /(?:^\d+\. .+\n?)+/gm,
      (block) => {
        const items = block
          .split("\n")
          .filter((l) => /^\d+\. /.test(l))
          .map((l) => `<li>${l.replace(/^\d+\. /, "")}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }
    );

    // Paragraphs (lines not already wrapped in HTML tags)
    result = result
      .split("\n\n")
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (/^<(h[1-6]|pre|ul|ol|blockquote|hr|table|div)/.test(block)) return block;
        if (/^%%CODEBLOCK_\d+%%$/.test(block)) return block;
        return `<p>${block}</p>`;
      })
      .join("\n");

    // Restore code blocks from placeholders
    for (let i = 0; i < codeBlocks.length; i++) {
      result = result.replace(`%%CODEBLOCK_${i}%%`, codeBlocks[i]);
    }

    return result;
  });
</script>

{@html html}

interface MarkdownNode {
  type: string;
  depth?: number;
  value?: string;
  children?: MarkdownNode[];
  data?: Record<string, unknown>;
}

/** Blocks that render nothing visible before the page's h1. */
function isLeadingNonContent(node: MarkdownNode): boolean {
  if (node.type === "yaml" || node.type === "toml" || node.type === "mdxjsEsm") return true;
  if (node.type === "mdxFlowExpression") return true;
  return node.type === "html" && /^\s*<!--[\s\S]*-->\s*$/.test(node.value ?? "");
}

function identifier(name: string) {
  return { type: "Identifier", name };
}

function jsxIdentifier(name: string) {
  return { type: "JSXIdentifier", name };
}

/**
 * `{((Slot) => Slot ? <Slot position="…" /> : null)(props.components?.DocsTitleSlot)}`
 *
 * Read from the components the page is rendered with instead of importing the
 * theme, so a theme or component map without the slot renders nothing here and
 * keeps its earlier behavior. The component is bound to a local name because
 * MDX guards JSX that names `props.components.*` directly and throws when the
 * component is missing.
 */
function titleSlotExpression(position: "title" | "description"): MarkdownNode {
  const slot = identifier("Slot");
  const expression = {
    type: "CallExpression",
    optional: false,
    callee: {
      type: "ArrowFunctionExpression",
      id: null,
      async: false,
      generator: false,
      expression: true,
      params: [slot],
      body: {
        type: "ConditionalExpression",
        test: identifier("Slot"),
        consequent: {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: jsxIdentifier("Slot"),
            attributes: [
              {
                type: "JSXAttribute",
                name: jsxIdentifier("position"),
                value: { type: "Literal", value: position, raw: JSON.stringify(position) },
              },
            ],
            selfClosing: true,
          },
          closingElement: null,
          children: [],
        },
        alternate: { type: "Literal", value: null, raw: "null" },
      },
    },
    arguments: [
      {
        type: "ChainExpression",
        expression: {
          type: "MemberExpression",
          object: {
            type: "MemberExpression",
            object: identifier("props"),
            property: identifier("components"),
            computed: false,
            optional: false,
          },
          property: identifier("DocsTitleSlot"),
          computed: false,
          optional: true,
        },
      },
    ],
  };

  return {
    type: "mdxFlowExpression",
    value: `((Slot) => Slot ? <Slot position=${JSON.stringify(position)} /> : null)(props.components?.DocsTitleSlot)`,
    data: {
      estree: {
        type: "Program",
        sourceType: "module",
        comments: [],
        body: [{ type: "ExpressionStatement", expression }],
      },
    },
  };
}

/**
 * Place the theme's title slot after a page's own h1, and a second one after
 * the paragraph that follows it, where the description sits when the body
 * already starts with it. The theme fills whichever matches the page, so the
 * description and below-title block are part of the server render.
 *
 * Only a page whose first visible block is its h1 gets slots; any other page
 * keeps the theme's client-side placement.
 */
export function remarkDocsTitleSlot() {
  return (tree: MarkdownNode) => {
    const children = tree.children;
    if (!children) return tree;

    const titleIndex = children.findIndex((node) => !isLeadingNonContent(node));
    const title = children[titleIndex];
    if (!title || title.type !== "heading" || title.depth !== 1) return tree;

    children.splice(titleIndex + 1, 0, titleSlotExpression("title"));
    if (children[titleIndex + 2]?.type === "paragraph") {
      children.splice(titleIndex + 3, 0, titleSlotExpression("description"));
    }
    return tree;
  };
}

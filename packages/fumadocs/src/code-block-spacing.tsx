import * as React from "react";

type PreProps = React.ComponentPropsWithoutRef<"pre">;

const leadingWhitespacePattern = /^[\t ]+/;

function whitespaceColumnCount(value: string): number {
  let columns = 0;
  for (const char of value) {
    columns += char === "\t" ? 4 : 1;
  }
  return columns;
}

function splitLeadingWhitespace(value: string, key: string): React.ReactNode {
  const match = value.match(leadingWhitespacePattern);
  if (!match) return value;

  const leadingWhitespace = match[0] ?? "";
  const rest = value.slice(leadingWhitespace.length);
  if (!rest.startsWith("--")) return value;

  const isSingleWordGap = leadingWhitespace === " ";

  return [
    <span
      key={`${key}-space`}
      data-fd-code-space={isSingleWordGap ? "gap" : "indent"}
      style={
        {
          "--fd-code-space-count": whitespaceColumnCount(leadingWhitespace),
        } as React.CSSProperties
      }
    >
      {leadingWhitespace}
    </span>,
    rest,
  ];
}

function normalizeNode(node: React.ReactNode, key: string): React.ReactNode {
  if (typeof node === "string") {
    return splitLeadingWhitespace(node, key);
  }

  if (!React.isValidElement(node)) {
    return node;
  }

  const props = node.props as { children?: React.ReactNode };
  if (props.children === undefined) {
    return node;
  }

  return React.cloneElement(
    node as React.ReactElement<{ children?: React.ReactNode }>,
    undefined,
    React.Children.map(props.children, (child, index) => normalizeNode(child, `${key}-${index}`)),
  );
}

function normalizeCodeSpacing(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (child, index) => normalizeNode(child, `${index}`));
}

export function createPreWithCodeSpacing(
  DefaultPre: React.ComponentType<PreProps> | "pre",
): React.ComponentType<PreProps> {
  return function PreWithCodeSpacing(props: PreProps) {
    const normalizedChildren = normalizeCodeSpacing(props.children);

    if (typeof DefaultPre === "string") {
      return <pre {...props}>{normalizedChildren}</pre>;
    }

    const Pre = DefaultPre;
    return <Pre {...props}>{normalizedChildren}</Pre>;
  };
}

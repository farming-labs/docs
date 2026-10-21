import * as React from "react";

type PreProps = React.ComponentPropsWithoutRef<"pre">;

const leadingWhitespacePattern = /^[\t ]+(?=--)/;

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
  if (
    props.children === undefined ||
    (typeof props.children === "string" && !leadingWhitespacePattern.test(props.children))
  ) {
    return node;
  }

  const children = normalizeCodeSpacing(props.children, key);
  if (children === props.children) return node;

  return React.cloneElement(
    node as React.ReactElement<{ children?: React.ReactNode }>,
    undefined,
    children,
  );
}

function canReuseChildren(children: React.ReactNode): boolean {
  if (Array.isArray(children)) return children.every(canReuseChildren);
  return children === null || typeof children !== "object" || React.isValidElement(children);
}

function normalizeCodeSpacing(children: React.ReactNode, key?: string): React.ReactNode {
  const childKey = (index: number) => (key === undefined ? `${index}` : `${key}-${index}`);
  if (typeof children === "string") {
    const next = splitLeadingWhitespace(children, childKey(0));
    return next === children ? children : React.Children.map(children, () => next);
  }

  // Iterables may be consumed only once; retain React's normal mapping for them.
  if (!canReuseChildren(children)) {
    return React.Children.map(children, (child, index) => normalizeNode(child, childKey(index)));
  }

  let changed = false;
  const normalized: React.ReactNode[] = [];
  React.Children.forEach(children, (child, index) => {
    const next = normalizeNode(child, childKey(index));
    changed ||= next !== child;
    normalized.push(next);
  });

  return changed ? React.Children.map(children, (_, index) => normalized[index]) : children;
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

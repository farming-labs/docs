import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createPreWithCodeSpacing } from "./code-block-spacing.js";

type PreProps = React.ComponentPropsWithoutRef<"pre">;
const Pre = createPreWithCodeSpacing("pre") as (props: PreProps) => React.ReactElement<PreProps>;

const code = (children: React.ReactNode) => React.createElement("code", null, children);
const token = (text: string, key: string) =>
  React.createElement("span", { key, style: { color: "red" } }, text);

const render = (children: React.ReactNode) =>
  renderToStaticMarkup(React.createElement(Pre, null, children));

describe("code block spacing", () => {
  it("preserves an unchanged highlighted tree and its text", () => {
    const children = code([
      React.createElement(
        "span",
        { key: "line", className: "line" },
        token("const answer", "a"),
        token(" = 42;", "b"),
      ),
      "\n",
      React.createElement(React.Fragment, { key: "fragment" }, "\treturn answer;"),
      null,
      false,
    ]);
    expect(Pre({ children }).props.children).toBe(children);
    expect(render(children)).toBe(renderToStaticMarkup(React.createElement("pre", null, children)));
  });

  it("preserves attributes and code text while splitting only flag whitespace", () => {
    const children = code([
      token("pnpm", "command"),
      [token(" --filter", "flag"), token(" docs", "value")],
      "\n",
      token("\t  --prod", "indented"),
      token("  ordinary indentation", "ordinary"),
    ]);
    const html = render(children);
    expect(html).toContain(
      'data-fd-code-space="gap" style="--fd-code-space-count:1"> </span>--filter',
    );
    expect(html).toContain(
      'data-fd-code-space="indent" style="--fd-code-space-count:6">\t  </span>--prod',
    );
    expect(html).toContain('style="color:red"');
    expect(html).toContain("  ordinary indentation");
    expect(html.replace(/<[^>]*>/g, "")).toBe(
      "pnpm --filter docs\n\t  --prod  ordinary indentation",
    );
  });

  it("keeps custom pre props and handles a direct string", () => {
    const CustomPre = (props: PreProps) => React.createElement("pre", props);
    const Wrapped = createPreWithCodeSpacing(CustomPre);
    expect(
      renderToStaticMarkup(
        React.createElement(Wrapped, { title: "command", className: "custom" }, " --help"),
      ),
    ).toBe(
      '<pre title="command" class="custom"><span data-fd-code-space="gap" style="--fd-code-space-count:1"> </span>--help</pre>',
    );
  });

  it("consumes nested one-shot iterables once, including those without flags", () => {
    function* tokens(flag: boolean) {
      yield token("pnpm", "command");
      yield token(flag ? " --help" : " help", "argument");
    }
    expect(render(code([tokens(false)]))).toContain(" help</span>");
    const html = render(code([tokens(true)]));
    expect(html).toContain("pnpm");
    expect(html).toContain('data-fd-code-space="gap"');
    expect(html).toContain("--help");
  });
});

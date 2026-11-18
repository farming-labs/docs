import { expect, it } from "vitest";
import { findDocsAudienceMdxTags, resolveDocsAudienceMdxContent } from "./audience.js";

it("preserves static tag metadata, original offsets and independent audience results", () => {
  const source =
    "# 🌱\n\n<Audience only='agent'>\nPrivate example.\n</Audience>\n\n<Human>\nHuman example.\n</Human>";
  const tags = findDocsAudienceMdxTags(source);
  expect(tags.map((t) => source.slice(t.index, t.end))).toEqual([
    "<Audience only='agent'>",
    "</Audience>",
    "<Human>",
    "</Human>",
  ]);
  expect(tags[0]).toMatchObject({
    only: "agent",
    onlyKind: "static",
    attributes: " only='agent'",
    hasOnlyAttribute: true,
  });
  tags[0].only = "human";
  expect(resolveDocsAudienceMdxContent(source, "human")).not.toContain("Private example.");
  expect(resolveDocsAudienceMdxContent(source, "agent")).toContain("Private example.");
  expect(
    resolveDocsAudienceMdxContent(source.replace("Private example.", "Edited."), "agent"),
  ).toContain("Edited.");
});

it("keeps JSX expressions, literals and raw regions on the docs visitor", () => {
  const source =
    "~~~md\n<Agent>\n~~~\n\n<script>\nconst literal='<Human>';\n</script>\n\n{true && <Agent>Expr</Agent>}\n\n<Human>\nVisible\n</Human>";
  const tags = findDocsAudienceMdxTags(source);
  expect(tags.map((t) => [t.name, Boolean(t.expression)])).toEqual([
    ["Agent", true],
    ["Agent", true],
    ["Human", false],
    ["Human", false],
  ]);
});

it.each(["< Agent />", "<\nAgent />", "</* comment */Agent />"])(
  "preserves JSX tag discovery with trivia before the name in %s",
  (tag) => {
    const source = "<Human>\nDocs\n</Human>\n\n{ok && " + tag + "}";
    expect(findDocsAudienceMdxTags(source).map((node) => node.name)).toEqual([
      "Human",
      "Human",
      "Agent",
    ]);
  },
);

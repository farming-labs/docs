import React from "react";
import { Tabs as FumadocsTabs } from "fumadocs-ui/components/tabs";
import {
  CodeBlockTabsList as FumadocsCodeBlockTabsList,
  CodeBlockTabsTrigger as FumadocsCodeBlockTabsTrigger,
} from "fumadocs-ui/components/codeblock";

/**
 * The docs tabs, with the class names the docs themes style. Themes style these classes rather
 * than every `[role="tab"]`, so tabs elsewhere on a page that loads the docs CSS (an app's own
 * pages share one stylesheet on some frameworks) keep their own look.
 */

function withClassName(className: string, extra: unknown): string {
  return typeof extra === "string" && extra ? `${className} ${extra}` : className;
}

export function Tabs(props: React.ComponentProps<typeof FumadocsTabs>) {
  return <FumadocsTabs {...props} className={withClassName("fd-tabs", props.className)} />;
}

export function CodeBlockTabsList(props: React.ComponentProps<typeof FumadocsCodeBlockTabsList>) {
  return (
    <FumadocsCodeBlockTabsList
      {...props}
      className={withClassName("fd-tabs-list", props.className)}
    />
  );
}

export function CodeBlockTabsTrigger(
  props: React.ComponentProps<typeof FumadocsCodeBlockTabsTrigger>,
) {
  return (
    <FumadocsCodeBlockTabsTrigger
      {...props}
      className={withClassName("fd-tabs-trigger", props.className)}
    />
  );
}

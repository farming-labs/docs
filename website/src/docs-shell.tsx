import type { ReactNode } from "react";
import { Databuddy } from "@databuddy/sdk/react";
import { ThemeCustomizer } from "@/components/theme-customizer";

/**
 * Docs pages render outside src/app/layout.tsx, so this adds the same site-wide widgets to them:
 * the theme customizer and analytics. Keep it in step with the root layout's body.
 */
export default function DocsShell({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ThemeCustomizer />
      <Databuddy
        clientId="e0e31f34-2bef-4e80-8904-ca3cba9bfba3"
        trackAttributes={true}
        trackHashChanges={true}
        trackOutgoingLinks={true}
      />
    </>
  );
}

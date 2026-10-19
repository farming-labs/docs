import type { ReactNode } from "react";

/**
 * Wraps every docs page the Farm adapter renders. This default renders the page as is; an app
 * replaces it through `withDocs(config, { shell })` to add what its root layout adds to other
 * routes, such as analytics or site-wide widgets, because Farm does not render docs pages inside
 * the app's root layout.
 */
export default function FarmDocsShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

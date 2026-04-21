import type { ReactNode } from "react";
import { RootProvider } from "@farming-labs/theme";
import docsConfig from "@/docs.config";
import "./global.css";

export const metadata = {
  title: {
    default: "Northstar CRM Developer Docs",
    template: docsConfig.metadata?.titleTemplate ?? "%s",
  },
  description: docsConfig.metadata?.description,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}

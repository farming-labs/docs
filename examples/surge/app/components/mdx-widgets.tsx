import Link from "next/link";
import type { ReactNode } from "react";

export function Warning({ children }: { children: ReactNode }) {
  return (
    <div className="surge-warning">
      <strong>Important</strong>
      <div>{children}</div>
    </div>
  );
}

export function Steps({ children }: { children: ReactNode }) {
  return <div className="surge-steps">{children}</div>;
}

export function Step({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="surge-step">
      <div className="surge-step-header">
        <span className="surge-step-index" aria-hidden="true" />
        <h3 className="surge-step-title">{title}</h3>
      </div>
      <div>{children}</div>
    </section>
  );
}

export function CodeGroup({ children }: { children: ReactNode }) {
  return <div className="surge-code-group">{children}</div>;
}

export function MdxLink({
  children,
  href,
}: {
  children: ReactNode;
  href?: string;
}) {
  if (!href) return <>{children}</>;

  if (href.startsWith("mailto:") || href.startsWith("http://") || href.startsWith("https://")) {
    return (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
        {children}
      </a>
    );
  }

  return <Link href={href}>{children}</Link>;
}

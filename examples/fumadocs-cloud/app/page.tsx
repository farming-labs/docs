import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-fd-background text-fd-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-fd-muted-foreground">
          @farming-labs/docs
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Fumadocs docs with Docs Cloud server wiring
        </h1>
        <p className="max-w-2xl text-base leading-7 text-fd-muted-foreground">
          This example validates the merged docs API route, copied docs content, client analytics
          project id wiring, and server-only Docs Cloud API key setup.
        </p>
        <div>
          <Link
            href="/docs"
            className="inline-flex h-10 items-center border border-fd-border px-4 text-sm font-medium"
          >
            Open docs
          </Link>
        </div>
      </section>
    </main>
  );
}

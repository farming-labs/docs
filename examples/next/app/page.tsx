import Link from "next/link";

export default function Home() {
  return (
    <div
      style={{
        maxWidth: 768,
        margin: "0 auto",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1>Docs Framework Example</h1>
      <p>Welcome to the Farming Labs docs framework (Next.js example).</p>
      <ul>
        <li>
          <Link href="/docs?lang=en">Docs root</Link>
        </li>
        <li>
          <Link href="/docs/installation?lang=en">Installation</Link>
        </li>
        <li>
          <Link href="/docs/getting-started?lang=en">Get Started</Link>
        </li>
      </ul>
    </div>
  );
}

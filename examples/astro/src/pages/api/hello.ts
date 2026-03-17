/** Hello endpoint */
export async function GET() {
  return new Response(JSON.stringify({ ok: true, message: "Hello from Astro" }), {
    headers: {
      "Content-Type": "application/json",
    },
  });
}

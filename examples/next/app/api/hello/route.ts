/**
 * Hello world endpoint.
 * Returns a simple JSON payload so the generated API reference has a basic route to show.
 */
export async function GET() {
  return Response.json({
    ok: true,
    message: "Hello from the Next.js API reference example.",
  });
}

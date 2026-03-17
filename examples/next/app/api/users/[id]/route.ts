/**
 * Look up a single user.
 * Demonstrates a dynamic route segment in the generated API reference sidebar.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return Response.json({
    id,
    name: "Example User",
    role: "admin",
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return Response.json({
    ok: true,
    deletedUserId: id,
  });
}

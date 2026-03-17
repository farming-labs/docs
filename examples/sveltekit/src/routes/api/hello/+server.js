import { json } from "@sveltejs/kit";

/** Hello endpoint */
export const GET = async () => {
  return json({ ok: true, message: "Hello from SvelteKit" });
};

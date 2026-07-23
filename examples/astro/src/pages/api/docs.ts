import type { APIRoute } from "astro";
import { GET as docsGET, HEAD as docsHEAD, POST as docsPOST } from "../../lib/docs.server";

export const GET: APIRoute = async ({ request }) => {
  return docsGET({ request });
};

export const HEAD: APIRoute = async ({ request }) => {
  return docsHEAD({ request });
};

export const POST: APIRoute = async ({ request }) => {
  return docsPOST({ request });
};

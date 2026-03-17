/** Hello endpoint */
export default defineEventHandler(() => {
  return {
    ok: true,
    message: "Hello from Nuxt",
  };
});

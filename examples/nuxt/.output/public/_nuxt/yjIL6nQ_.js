import { ac as a, ad as s, ae as r, j as u, af as o } from "./UEFHYZlh.js";
function c(e) {
  const t = e || s();
  return (
    t?.ssrContext?.head ||
    t?.runWithContext(() => {
      if (r()) return u(o);
    })
  );
}
function d(e, t = {}) {
  const n = c(t.nuxt);
  if (n) return a(e, { head: n, ...t });
}
export { d as u };

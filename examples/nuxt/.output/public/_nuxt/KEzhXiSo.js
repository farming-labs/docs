import {
  e as O,
  W as A,
  u as q,
  F as T,
  X as j,
  Y as E,
  Z as N,
  $ as U,
  a0 as L,
  a1 as P,
  a2 as I,
  a3 as H,
  s as F,
  r as D,
  a4 as _,
  a5 as V,
  n as W,
  m as y,
  a6 as B,
  a7 as z,
  a8 as M,
  a9 as $,
  aa as G,
  ab as Q,
} from "./UEFHYZlh.js";
const X = (...t) => t.find((o) => o !== void 0);
function Y(t) {
  const o = t.componentName || "NuxtLink";
  function f(e) {
    return typeof e == "string" && e.startsWith("#");
  }
  function S(e, l, v) {
    const a = v ?? t.trailingSlash;
    if (!e || (a !== "append" && a !== "remove")) return e;
    if (typeof e == "string") return C(e, a);
    const u = "path" in e && e.path !== void 0 ? e.path : l(e).path;
    return { ...e, name: void 0, path: C(u, a) };
  }
  function k(e) {
    const l = A(),
      v = Q(),
      a = y(() => !!e.target && e.target !== "_self"),
      u = y(() => {
        const i = e.to || e.href || "";
        return typeof i == "string" && B(i, { acceptRelative: !0 });
      }),
      p = P("RouterLink"),
      h = typeof p != "string" ? p.useLink : void 0,
      c = y(() => {
        if (e.external) return !0;
        const i = e.to || e.href || "";
        return typeof i == "object" ? !1 : i === "" || u.value;
      }),
      n = y(() => {
        const i = e.to || e.href || "";
        return c.value ? i : S(i, l.resolve, e.trailingSlash);
      }),
      g = c.value ? void 0 : h?.({ ...e, to: n }),
      b = y(() => {
        const i = e.trailingSlash ?? t.trailingSlash;
        if (!n.value || u.value || f(n.value)) return n.value;
        if (c.value) {
          const x = typeof n.value == "object" && "path" in n.value ? _(n.value) : n.value,
            R = typeof x == "object" ? l.resolve(x).href : x;
          return C(R, i);
        }
        return typeof n.value == "object"
          ? (l.resolve(n.value)?.href ?? null)
          : C(z(v.app.baseURL, n.value), i);
      });
    return {
      to: n,
      hasTarget: a,
      isAbsoluteUrl: u,
      isExternal: c,
      href: b,
      isActive: g?.isActive ?? y(() => n.value === l.currentRoute.value.path),
      isExactActive: g?.isExactActive ?? y(() => n.value === l.currentRoute.value.path),
      route: g?.route ?? y(() => l.resolve(n.value)),
      async navigate(i) {
        await W(b.value, { replace: e.replace, external: c.value || a.value });
      },
    };
  }
  return O({
    name: o,
    props: {
      to: { type: [String, Object], default: void 0, required: !1 },
      href: { type: [String, Object], default: void 0, required: !1 },
      target: { type: String, default: void 0, required: !1 },
      rel: { type: String, default: void 0, required: !1 },
      noRel: { type: Boolean, default: void 0, required: !1 },
      prefetch: { type: Boolean, default: void 0, required: !1 },
      prefetchOn: { type: [String, Object], default: void 0, required: !1 },
      noPrefetch: { type: Boolean, default: void 0, required: !1 },
      activeClass: { type: String, default: void 0, required: !1 },
      exactActiveClass: { type: String, default: void 0, required: !1 },
      prefetchedClass: { type: String, default: void 0, required: !1 },
      replace: { type: Boolean, default: void 0, required: !1 },
      ariaCurrentValue: { type: String, default: void 0, required: !1 },
      external: { type: Boolean, default: void 0, required: !1 },
      custom: { type: Boolean, default: void 0, required: !1 },
      trailingSlash: { type: String, default: void 0, required: !1 },
    },
    useLink: k,
    setup(e, { slots: l }) {
      const v = A(),
        { to: a, href: u, navigate: p, isExternal: h, hasTarget: c, isAbsoluteUrl: n } = k(e),
        g = F(!1),
        b = D(null),
        i = (s) => {
          b.value = e.custom ? s?.$el?.nextElementSibling : s?.$el;
        };
      function x(s) {
        return (
          !g.value &&
          (typeof e.prefetchOn == "string"
            ? e.prefetchOn === s
            : (e.prefetchOn?.[s] ?? t.prefetchOn?.[s])) &&
          (e.prefetch ?? t.prefetch) !== !1 &&
          e.noPrefetch !== !0 &&
          e.target !== "_blank" &&
          !K()
        );
      }
      async function R(s = q()) {
        if (g.value) return;
        g.value = !0;
        const d =
            typeof a.value == "string"
              ? a.value
              : h.value
                ? _(a.value)
                : v.resolve(a.value).fullPath,
          r = h.value ? new URL(d, window.location.href).href : d;
        await Promise.all([
          s.hooks.callHook("link:prefetch", r).catch(() => {}),
          !h.value && !c.value && V(a.value, v).catch(() => {}),
        ]);
      }
      if (x("visibility")) {
        const s = q();
        let d,
          r = null;
        (T(() => {
          const m = Z();
          j(() => {
            d = E(() => {
              b?.value?.tagName &&
                (r = m.observe(b.value, async () => {
                  (r?.(), (r = null), await R(s));
                }));
            });
          });
        }),
          N(() => {
            (d && U(d), r?.(), (r = null));
          }));
      }
      return () => {
        if (!h.value && !c.value && !f(a.value)) {
          const r = {
            ref: i,
            to: a.value,
            activeClass: e.activeClass || t.activeClass,
            exactActiveClass: e.exactActiveClass || t.exactActiveClass,
            replace: e.replace,
            ariaCurrentValue: e.ariaCurrentValue,
            custom: e.custom,
          };
          return (
            e.custom ||
              (x("interaction") &&
                ((r.onPointerenter = R.bind(null, void 0)), (r.onFocus = R.bind(null, void 0))),
              g.value && (r.class = e.prefetchedClass || t.prefetchedClass),
              (r.rel = e.rel || void 0)),
            L(P("RouterLink"), r, l.default)
          );
        }
        const s = e.target || null,
          d =
            X(
              e.noRel ? "" : e.rel,
              t.externalRelAttribute,
              n.value || c.value ? "noopener noreferrer" : "",
            ) || null;
        return e.custom
          ? l.default
            ? l.default({
                href: u.value,
                navigate: p,
                prefetch: R,
                get route() {
                  if (!u.value) return;
                  const r = new URL(u.value, window.location.href);
                  return {
                    path: r.pathname,
                    fullPath: r.pathname,
                    get query() {
                      return I(r.search);
                    },
                    hash: r.hash,
                    params: {},
                    name: void 0,
                    matched: [],
                    redirectedFrom: void 0,
                    meta: {},
                    href: u.value,
                  };
                },
                rel: d,
                target: s,
                isExternal: h.value || c.value,
                isActive: !1,
                isExactActive: !1,
              })
            : null
          : L(
              "a",
              {
                ref: b,
                href: u.value || null,
                rel: d,
                target: s,
                onClick: async (r) => {
                  if (!(h.value || c.value)) {
                    r.preventDefault();
                    try {
                      const m = H(u.value);
                      return await (e.replace ? v.replace(m) : v.push(m));
                    } finally {
                      if (f(a.value)) {
                        const m = a.value.slice(1);
                        let w = m;
                        try {
                          w = decodeURIComponent(m);
                        } catch {}
                        document.getElementById(w)?.focus();
                      }
                    }
                  }
                },
              },
              l.default?.(),
            );
      };
    },
  });
}
const ae = Y(M);
function C(t, o) {
  const f = o === "append" ? $ : G;
  return B(t) && !t.startsWith("http") ? t : f(t, !0);
}
function Z() {
  const t = q();
  if (t._observer) return t._observer;
  let o = null;
  const f = new Map(),
    S = (e, l) => (
      (o ||= new IntersectionObserver((v) => {
        for (const a of v) {
          const u = f.get(a.target);
          (a.isIntersecting || a.intersectionRatio > 0) && u && u();
        }
      })),
      f.set(e, l),
      o.observe(e),
      () => {
        (f.delete(e), o?.unobserve(e), f.size === 0 && (o?.disconnect(), (o = null)));
      }
    );
  return (t._observer = { observe: S });
}
const J = /2g/;
function K() {
  const t = navigator.connection;
  return !!(t && (t.saveData || J.test(t.effectiveType)));
}
export { ae as _ };

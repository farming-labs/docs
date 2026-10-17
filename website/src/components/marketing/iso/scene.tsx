// A small drawing kit for isometric hairline figures, after the farm.js scene kit:
// a camera, shapes that draw through it, printed names, and a clock that only runs
// while the figure is on screen. Styles live under `.iso-scene` in app/globals.css.

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export const UNIT = 30;
const ARC_STEPS = 5;

export type Point2 = [number, number];
export type Point3 = [number, number, number];

export const clamp = (value: number) => Math.min(1, Math.max(0, value));
export const ease = (value: number) => value * value * (3 - 2 * value);
export const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
/** How far `t` is through the window [start, start + length], eased. */
export const phase = (t: number, start: number, length: number) =>
  ease(clamp((t - start) / length));

// Server and browser can disagree in the last bit of a sine, which flips a rounded
// coordinate and breaks hydration. Snap trigonometry and never print -0.
const snap = (value: number) => Math.round(value * 1e9) / 1e9;
const fixed = (value: number) => (Math.abs(value) < 0.005 ? 0 : value).toFixed(2);
const format = ([sx, sy]: Point2) => `${fixed(sx)},${fixed(sy)}`;

/** World x runs right, y toward the viewer, z up. The camera turns about z, then tilts. */
export type Camera = { yaw: number; pitch: number; scale: number };

export function lens({ yaw, pitch, scale }: Camera) {
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)].map(
    snap,
  ) as [number, number, number, number];
  const k = scale * UNIT;
  const at = (x: number, y: number, z: number): Point2 => [
    (x * cy - y * sy) * k,
    ((x * sy + y * cy) * sp - z * cp) * k,
  ];
  return {
    at,
    points: (corners: Point3[]) => corners.map(([x, y, z]) => format(at(x, y, z))).join(" "),
    path: (lines: Point3[][]) =>
      lines
        .map((line) =>
          line.map(([x, y, z], i) => `${i ? "L" : "M"}${format(at(x, y, z))}`).join(""),
        )
        .join(""),
    across: (x: number, y: number) => x * cy - y * sy,
    depth: (x: number, y: number) => x * sy + y * cy,
    axes: {
      x: [cy * scale, sy * sp * scale] as Point2,
      y: [-sy * scale, cy * sp * scale] as Point2,
      down: [0, cp * scale] as Point2,
    },
    flat: [k, k * sp] as Point2,
  };
}
export type Lens = ReturnType<typeof lens>;

/** A rounded rectangle's outline in world x/y. */
function roundRect([x0, x1]: Point2, [y0, y1]: Point2, r: number): Point2[] {
  const radius = Math.min(r, (x1 - x0) / 2, (y1 - y0) / 2);
  const corners: [number, number, number][] = [
    [x1 - radius, y0 + radius, -90],
    [x1 - radius, y1 - radius, 0],
    [x0 + radius, y1 - radius, 90],
    [x0 + radius, y0 + radius, 180],
  ];
  return corners.flatMap(([cx, cy, start]) =>
    Array.from({ length: ARC_STEPS + 1 }, (_, step): Point2 => {
      const angle = ((start + (90 * step) / ARC_STEPS) * Math.PI) / 180;
      return [cx + radius * snap(Math.cos(angle)), cy + radius * snap(Math.sin(angle))];
    }),
  );
}

/**
 * A slab with rounded corners: the band of side the camera can see, then the top.
 * Faces fill with the page colour, so whatever is drawn later sits in front.
 */
export function Slab({
  lens: l,
  x,
  y,
  z: [z0, z1],
  r,
  className,
  style,
  children,
}: {
  lens: Lens;
  x: Point2;
  y: Point2;
  z: Point2;
  r: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const outline = roundRect(x, y, r);
  let left = 0;
  let right = 0;
  outline.forEach(([px, py], i) => {
    if (l.across(px, py) < l.across(...outline[left]!)) left = i;
    if (l.across(px, py) > l.across(...outline[right]!)) right = i;
  });
  const arc = (from: number, to: number) => {
    const result: Point2[] = [];
    for (let i = from; ; i = (i + 1) % outline.length) {
      result.push(outline[i]!);
      if (i === to) return result;
    }
  };
  const nearness = (line: Point2[]) =>
    line.reduce((sum, [px, py]) => sum + l.depth(px, py), 0) / line.length;
  const forward = arc(left, right);
  const backward = arc(right, left).reverse();
  const near = nearness(forward) > nearness(backward) ? forward : backward;
  return (
    <g className={className} style={style}>
      <polygon
        className="iso-side"
        points={l.points([
          ...near.map(([px, py]): Point3 => [px, py, z1]),
          ...[...near].reverse().map(([px, py]): Point3 => [px, py, z0]),
        ])}
      />
      <polygon className="iso-top" points={l.points(outline.map(([px, py]) => [px, py, z1]))} />
      {children}
    </g>
  );
}

/** A rounded outline lying flat at height z: a card on a top, a footprint on the ground. */
export function Inset({
  lens: l,
  x,
  y,
  z,
  r = 0,
  className = "iso-detail",
}: {
  lens: Lens;
  x: Point2;
  y: Point2;
  z: number;
  r?: number;
  className?: string;
}) {
  return (
    <polygon
      className={className}
      points={l.points(roundRect(x, y, r).map(([px, py]): Point3 => [px, py, z]))}
    />
  );
}

/** Open lines through world points. */
export function Line({
  lens: l,
  lines,
  className,
}: {
  lens: Lens;
  lines: Point3[][];
  className?: string;
}) {
  return <path className={className} d={l.path(lines)} />;
}

/** Text printed on a surface, from the left end of its baseline. */
export function Print({
  lens: l,
  at: [x, y, z],
  face = "front",
  size = 4.5,
  className = "iso-print",
  children,
}: {
  lens: Lens;
  at: Point3;
  face?: "top" | "front";
  size?: number;
  className?: string;
  children: ReactNode;
}) {
  const [sx, sy] = l.at(x, y, z);
  const [a, b] = l.axes.x;
  const [c, d] = face === "top" ? l.axes.y : l.axes.down;
  const n = (value: number) => (Math.abs(value) < 0.00005 ? 0 : value).toFixed(4);
  return (
    <text
      className={className}
      style={{ "--iso-text": size } as CSSProperties}
      transform={`matrix(${n(a)} ${n(b)} ${n(c)} ${n(d)} ${fixed(sx)} ${fixed(sy)})`}
    >
      {children}
    </text>
  );
}

/** The bright cube that stands for whatever is moving. */
export function Packet({ lens: l, at: [x, y, z] }: { lens: Lens; at: Point3 }) {
  return (
    <Slab
      className="iso-packet"
      lens={l}
      r={0.04}
      x={[x - 0.12, x + 0.12]}
      y={[y - 0.12, y + 0.12]}
      z={[z, z + 0.22]}
    />
  );
}

/** The part of a polyline from its start to `amount` (0 to 1) of the way along. */
export function partial(line: Point3[], amount: number): Point3[] {
  const lengths = line
    .slice(1)
    .map(([x, y, z], i) => Math.hypot(x - line[i]![0], y - line[i]![1], z - line[i]![2]));
  let left = lengths.reduce((sum, length) => sum + length, 0) * clamp(amount);
  const result: Point3[] = [line[0]!];
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i]!;
    const [from, to] = [line[i]!, line[i + 1]!];
    if (left <= length) {
      const t = length ? left / length : 1;
      result.push([lerp(from[0], to[0], t), lerp(from[1], to[1], t), lerp(from[2], to[2], t)]);
      return result;
    }
    result.push(to);
    left -= length;
  }
  return result;
}
export const along = (line: Point3[], amount: number) => partial(line, amount).at(-1)!;

function prefersStill() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Milliseconds into a looping story. It starts at `from` (the pose the server draws
 * and reduced motion keeps), advances only while the figure is on screen and not
 * held, and picks up where it left off.
 */
export function useLoop(
  rootRef: React.RefObject<HTMLElement | null>,
  length: number,
  from: number,
  held = false,
) {
  const [t, setT] = useState(from);
  const tRef = useRef(t);
  tRef.current = t;
  const heldRef = useRef(held);
  heldRef.current = held;

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersStill()) return;
    let frame = 0;
    let visible = false;
    let start: number | null = null;
    const tick = (now: number) => {
      if (heldRef.current || !visible) {
        start = null;
        frame = 0;
        return;
      }
      start ??= now - tRef.current;
      setT((now - start) % length);
      frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = Boolean(entry?.isIntersecting);
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    observer.observe(root);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [rootRef, length, held]);

  return t;
}

const pointFormat = ([x, y]: Point2) => `${fixed(x)},${fixed(y)}`;

/**
 * A label wired to a part: a dot on the part, a wire that rises with a rounded
 * elbow, and the label at a size people can read. `from` and `to` are screen points
 * (from `lens.at`); `on` lights the wire when its part is the active one.
 */
export function Callout({
  from,
  to,
  label,
  align = "middle",
  on = false,
}: {
  from: Point2;
  to: Point2;
  label: string;
  align?: "start" | "middle" | "end";
  on?: boolean;
}) {
  const [fx, fy] = from;
  const [tx, ty] = to;
  const radius = Math.min(4, Math.abs(fy - ty) / 2, Math.abs(fx - tx) / 2);
  const d =
    Math.abs(fx - tx) < 0.5
      ? `M${pointFormat(from)}L${pointFormat([fx, ty + 3])}`
      : `M${pointFormat(from)}L${pointFormat([fx, ty + radius])}Q${pointFormat([fx, ty])} ${pointFormat([fx + Math.sign(tx - fx) * radius, ty])}L${pointFormat([tx, ty])}`;
  const textX = align === "start" ? tx + 3 : align === "end" ? tx - 3 : tx;
  const textY = Math.abs(fx - tx) < 0.5 ? ty : ty + 2.2;
  return (
    <g aria-hidden className="iso-callout" data-on={on || undefined}>
      <path d={d} />
      <circle cx={fixed(fx)} cy={fixed(fy)} r="1.5" />
      <text textAnchor={align} x={fixed(textX)} y={fixed(textY)}>
        {label}
      </text>
    </g>
  );
}

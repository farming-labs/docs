"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  type Point2,
  type Point3,
  Inset,
  Line,
  Packet,
  Print,
  Slab,
  along,
  lens,
  partial,
  phase,
  useLoop,
} from "@/components/marketing/iso/scene";

/* A low yaw runs the long plate across the card instead of down it. */
const WIDE = lens({ yaw: 0.38, pitch: 0.56, scale: 1.15 });
const PLATE = { x: [-0.4, 7.6] as Point2, y: [0, 3] as Point2, z: [0, 0.16] as Point2, r: 0.32 };
const TOP = 0.17;

function Figure({
  rootRef,
  view,
  readout,
  label,
  className,
  onHold,
  children,
}: {
  rootRef: React.RefObject<HTMLElement | null>;
  view: string;
  readout: React.ReactNode;
  label: string;
  className?: string;
  onHold: (held: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <figure
      aria-label={label}
      className={cn("iso-scene", className)}
      ref={rootRef as React.RefObject<HTMLElement>}
      onPointerEnter={(event) => event.pointerType !== "touch" && onHold(true)}
      onPointerLeave={() => onHold(false)}
    >
      <svg aria-hidden viewBox={view}>
        {children}
      </svg>
      <figcaption aria-live="off" className="iso-readout">
        {readout}
      </figcaption>
    </figure>
  );
}

function Plate() {
  return <Slab className="iso-base" lens={WIDE} {...PLATE} />;
}

/** The repository: a slab with file cards on top. */
function Repo({ lit, label = "repo" }: { lit: boolean; label?: string }) {
  return (
    <Slab
      className={lit ? "iso-lit" : undefined}
      lens={WIDE}
      r={0.12}
      x={[0.2, 1.8]}
      y={[0.6, 2.4]}
      z={[PLATE.z[1], 0.9]}
    >
      {([0.85, 1.35, 1.85] as const).map((y0) => (
        <Inset key={y0} lens={WIDE} r={0.05} x={[0.45, 1.55]} y={[y0, y0 + 0.38]} z={0.9} />
      ))}
      <Print at={[0.36, 2.4, 0.62]} lens={WIDE} size={5}>
        {label}
      </Print>
    </Slab>
  );
}

// ---------------------------------------------------------------------------
// Deploy: the repo rides to the build, the build stacks plate by plate, and the
// edge lights up with the live URL.

const DEPLOY_LOOP = 8000;
const UPLOAD: Point3[] = [
  [1.8, 1.5, TOP],
  [3.0, 1.5, TOP],
];
const SHIP: Point3[] = [
  [4.4, 1.5, TOP],
  [5.4, 1.5, TOP],
];
const BUILD_X: Point2 = [3.0, 4.4];
const BUILD_Y: Point2 = [0.9, 2.1];
const BUILD_LAYERS = ["pages", "search", "mcp"] as const;

export function CloudDeployFigure({ className }: { className?: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [held, setHeld] = useState(false);
  // The still pose (server render, reduced motion) is the finished deploy.
  const t = useLoop(rootRef, DEPLOY_LOOP, 5200, held);

  const upload = phase(t, 500, 1200);
  const layers = BUILD_LAYERS.map((_, i) => phase(t, 1700 + i * 380, 520));
  const ship = phase(t, 3100, 1200);
  const live = t >= 4300;
  const reset = phase(t, 7300, 500);
  const fade = 1 - reset;
  const packetAt =
    t >= 500 && t < 1700 ? along(UPLOAD, upload) : t >= 3100 && t < 4300 ? along(SHIP, ship) : null;

  const readout =
    t < 500
      ? "$ docs deploy"
      : t < 1700
        ? "uploading repo · main"
        : t < 3100
          ? `building ${BUILD_LAYERS.filter((_, i) => layers[i]! > 0).join(" · ") || "…"}`
          : t < 4300
            ? "shipping to the edge"
            : "live · acme.docs.app";

  return (
    <Figure
      rootRef={rootRef}
      className={className}
      label="A deploy: the repository uploads, the build stacks pages, search, and MCP, and the edge goes live at a docs.app URL."
      onHold={setHeld}
      readout={
        <>
          {live ? <span className="size-1.5 rounded-full bg-mk-ok" /> : null}
          {readout}
        </>
      }
      view="-64 -48 320 168"
    >
      <Plate />
      <Line className="iso-ghost" lens={WIDE} lines={[UPLOAD, SHIP]} />
      <g style={{ opacity: fade }}>
        {upload > 0 ? (
          <Line className="iso-trail" lens={WIDE} lines={[partial(UPLOAD, upload)]} />
        ) : null}
        {ship > 0 ? <Line className="iso-trail" lens={WIDE} lines={[partial(SHIP, ship)]} /> : null}
      </g>
      <Inset className="iso-ghost" lens={WIDE} r={0.1} x={BUILD_X} y={BUILD_Y} z={TOP} />

      <Repo lit={t >= 400 && t < 1700} />
      {packetAt && t < 1700 ? <Packet at={packetAt} lens={WIDE} /> : null}

      {BUILD_LAYERS.map((name, i) => {
        const p = layers[i]!;
        if (p <= 0) return null;
        const z0 = TOP + i * 0.17 + (1 - p) * 0.9;
        const last = i === BUILD_LAYERS.length - 1;
        return (
          <Slab
            className={t >= 1700 && t < 3100 && p < 1 ? "iso-lit" : undefined}
            key={name}
            lens={WIDE}
            r={0.1}
            style={{ opacity: p * fade }}
            x={BUILD_X}
            y={BUILD_Y}
            z={[z0, z0 + 0.11]}
          >
            {last ? (
              <>
                <Inset
                  lens={WIDE}
                  r={0.06}
                  x={[BUILD_X[0] + 0.2, BUILD_X[1] - 0.2]}
                  y={[BUILD_Y[0] + 0.2, BUILD_Y[1] - 0.35]}
                  z={z0 + 0.11}
                />
                <Print
                  at={[BUILD_X[0] + 0.22, BUILD_Y[1] - 0.12, z0 + 0.11]}
                  face="top"
                  lens={WIDE}
                  size={4.4}
                >
                  build
                </Print>
              </>
            ) : null}
          </Slab>
        );
      })}
      {packetAt && t >= 3100 ? <Packet at={packetAt} lens={WIDE} /> : null}

      <Slab
        className={live && reset < 1 ? "iso-lit" : undefined}
        lens={WIDE}
        r={0.14}
        x={[5.4, 6.9]}
        y={[0.8, 2.2]}
        z={[PLATE.z[1], 1.45]}
      >
        <Line
          className="iso-detail"
          lens={WIDE}
          lines={([0.5, 0.72, 0.94] as const).map((z): Point3[] => [
            [5.62, 2.2, z],
            [6.3, 2.2, z],
          ])}
        />
        <Line
          className={live ? "iso-trail" : "iso-detail"}
          lens={WIDE}
          lines={[
            [
              [6.48, 2.2, 0.94],
              [6.62, 2.2, 0.94],
            ],
          ]}
        />
        <Print at={[5.6, 2.2, 1.28]} lens={WIDE} size={5}>
          edge
        </Print>
        <Print at={[5.62, 1.95, 1.45]} face="top" lens={WIDE} size={4.4}>
          *.docs.app
        </Print>
      </Slab>
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Sync: content leaves the repo, the docs graph lights node by node as sections
// map, search and Ask AI catch up, and a draft PR rides back to GitHub.

const SYNC_LOOP = 9000;
const PULL: Point3[] = [
  [1.8, 1.15, TOP],
  [4.3, 1.15, TOP],
];
const PUSH: Point3[] = [
  [4.3, 1.95, TOP],
  [1.8, 1.95, TOP],
];
const NODES: { at: Point2; litAt: number; name?: string }[] = [
  { at: [4.9, 0.72], litAt: 1800, name: "guides" },
  { at: [6.55, 0.66], litAt: 2300, name: "api" },
  { at: [5.7, 1.5], litAt: 1300, name: "docs" },
  { at: [4.85, 2.32], litAt: 2700 },
  { at: [6.7, 2.26], litAt: 3100 },
];
const EDGES: [number, number][] = [
  [0, 2],
  [1, 2],
  [2, 3],
  [2, 4],
  [3, 4],
  [0, 1],
];

export function CloudSyncFigure({ className }: { className?: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [held, setHeld] = useState(false);
  const t = useLoop(rootRef, SYNC_LOOP, 6800, held);

  const reset = phase(t, 8300, 600);
  const fade = 1 - reset;
  const pulls = [0, 1, 2].map((k) => ({ start: 400 + k * 450, p: phase(t, 400 + k * 450, 900) }));
  const push = phase(t, 4800, 1200);
  const opened = t >= 6000 && reset < 1;
  const nodeOn = (i: number) => t >= NODES[i]!.litAt && reset < 0.5;

  const readout =
    t < 400
      ? "$ docs sync --search"
      : t < 2000
        ? "pulling MDX from main"
        : t < 3600
          ? "mapping sections into the graph"
          : t < 4800
            ? "syncing search and Ask AI"
            : t < 6000
              ? "drafting updates"
              : "draft PR opened on GitHub";

  return (
    <Figure
      rootRef={rootRef}
      className={className}
      label="Repo sync: MDX flows from the repository into a docs graph, search and Ask AI update, and a draft pull request goes back to GitHub."
      onHold={setHeld}
      readout={readout}
      view="-64 -40 320 160"
    >
      <Plate />
      <Line className="iso-ghost" lens={WIDE} lines={[PULL, PUSH]} />
      <Print at={[2.3, 1.02, TOP]} face="top" lens={WIDE} size={3.8}>
        pull
      </Print>
      <Print at={[2.3, 2.3, TOP]} face="top" lens={WIDE} size={3.8}>
        draft PR
      </Print>
      <g style={{ opacity: fade }}>
        {pulls.map(({ p, start }) =>
          p > 0 && t < start + 1200 ? (
            <Line className="iso-trail" key={start} lens={WIDE} lines={[partial(PULL, p)]} />
          ) : null,
        )}
        {push > 0 ? <Line className="iso-trail" lens={WIDE} lines={[partial(PUSH, push)]} /> : null}
      </g>
      {EDGES.map(([a, b]) => {
        const [ax, ay] = NODES[a]!.at;
        const [bx, by] = NODES[b]!.at;
        return (
          <path
            className="iso-edge"
            d={WIDE.path([
              [
                [ax, ay, TOP],
                [bx, by, TOP],
              ],
            ])}
            data-on={(nodeOn(a) && nodeOn(b)) || undefined}
            key={`${a}-${b}`}
          />
        );
      })}

      <Repo label={opened ? "repo · PR" : "repo"} lit={opened || (t >= 400 && t < 1400)} />

      {[...NODES.keys()]
        .sort((a, b) => WIDE.depth(...NODES[a]!.at) - WIDE.depth(...NODES[b]!.at))
        .map((i) => {
          const {
            at: [cx, cy],
            name,
          } = NODES[i]!;
          return (
            <Slab
              className={nodeOn(i) ? "iso-lit" : undefined}
              key={i}
              lens={WIDE}
              r={0.26}
              x={[cx - 0.26, cx + 0.26]}
              y={[cy - 0.26, cy + 0.26]}
              z={[PLATE.z[1], 0.4]}
            >
              {name ? (
                <Print at={[cx - 0.2, cy + 0.42, TOP]} face="top" lens={WIDE} size={3.8}>
                  {name}
                </Print>
              ) : null}
            </Slab>
          );
        })}

      {pulls.map(({ p, start }) =>
        p > 0 && p < 1 ? <Packet at={along(PULL, p)} key={start} lens={WIDE} /> : null,
      )}
      {push > 0 && push < 1 ? <Packet at={along(PUSH, push)} lens={WIDE} /> : null}
    </Figure>
  );
}

// ---------------------------------------------------------------------------
// Docs flow: a page card hops from draft to review to ship; the stage it sits on
// is lit.

const FLOW_LOOP = 7200;
const STAGES = [
  { name: "draft", x: [0, 1.6] as Point2 },
  { name: "review", x: [2.6, 4.2] as Point2 },
  { name: "ship", x: [5.2, 6.8] as Point2 },
] as const;
const STAGE_Y: Point2 = [0.3, 1.5];
const STAGE_Z: Point2 = [0, 0.22];
const centerX = (i: number) => (STAGES[i]!.x[0] + STAGES[i]!.x[1]) / 2;

export function CloudDocsFlowFigure({ className }: { className?: string }) {
  const rootRef = useRef<HTMLElement>(null);
  const [held, setHeld] = useState(false);
  const t = useLoop(rootRef, FLOW_LOOP, 5400, held);

  const hop1 = phase(t, 1500, 800);
  const hop2 = phase(t, 3800, 800);
  const settle = phase(t, 4600, 400);
  const reset = phase(t, 6600, 500);
  const stage = t < 1900 ? 0 : t < 4200 ? 1 : 2;
  const x =
    hop2 > 0
      ? centerX(1) + (centerX(2) - centerX(1)) * hop2
      : centerX(0) + (centerX(1) - centerX(0)) * hop1;
  const lift = Math.sin(Math.PI * (hop2 > 0 && hop2 < 1 ? hop2 : hop1 < 1 ? hop1 : 0)) * 0.5;
  const z = STAGE_Z[1] + 0.34 - settle * 0.24 + lift;
  const cardOpacity = 1 - reset;

  const readout =
    t < 1500
      ? "drafted with AI · getting-started.mdx"
      : t < 2300
        ? "opening a pull request"
        : t < 3800
          ? "in review"
          : t < 4600
            ? "merged"
            : "published to docs";

  return (
    <Figure
      rootRef={rootRef}
      className={className}
      label="A docs page moves from an AI draft, through review, to published."
      onHold={setHeld}
      readout={readout}
      view="-30 -30 256 110"
    >
      <Line
        className="iso-ghost"
        lens={WIDE}
        lines={[
          [
            [STAGES[0].x[1], 0.9, 0.02],
            [STAGES[1].x[0], 0.9, 0.02],
          ],
          [
            [STAGES[1].x[1], 0.9, 0.02],
            [STAGES[2].x[0], 0.9, 0.02],
          ],
        ]}
      />
      {STAGES.map((item, i) => (
        <Slab
          className={i === stage && reset < 0.5 ? "iso-lit" : undefined}
          key={item.name}
          lens={WIDE}
          r={0.14}
          x={item.x}
          y={STAGE_Y}
          z={STAGE_Z}
        >
          <Print at={[item.x[0] + 0.16, STAGE_Y[1], 0.17]} lens={WIDE} size={5}>
            {item.name}
          </Print>
        </Slab>
      ))}
      <g style={{ opacity: cardOpacity }}>
        <Slab
          className="iso-lit"
          lens={WIDE}
          r={0.06}
          x={[x - 0.45, x + 0.45]}
          y={[0.55, 1.25]}
          z={[z, z + 0.05]}
        >
          <Line
            className="iso-detail"
            lens={WIDE}
            lines={([0.72, 0.88, 1.04] as const).map((y, i): Point3[] => [
              [x - 0.3, y, z + 0.05],
              [x + (i === 2 ? 0.05 : 0.3), y, z + 0.05],
            ])}
          />
        </Slab>
      </g>
    </Figure>
  );
}

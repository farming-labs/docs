/**
 * MDX image component that works with ![alt](url) when width/height are not provided.
 * Fumadocs-ui's framework-aware image component keeps Next.js optimization when available
 * and falls back to a plain <img> in other runtimes.
 */

"use client";

import { Image } from "fumadocs-core/framework";
import type { ComponentProps } from "react";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

type ImgProps = ComponentProps<typeof Image>;

export function MDXImg(props: ImgProps) {
  const { src, alt = "", width, height, style, ...rest } = props;
  const w = width != null ? Number(width) : DEFAULT_WIDTH;
  const h = height != null ? Number(height) : DEFAULT_HEIGHT;

  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      style={{ maxWidth: "100%", height: "auto", ...style }}
      {...rest}
    />
  );
}

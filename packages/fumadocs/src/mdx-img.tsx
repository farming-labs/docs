/**
 * MDX image component that works with ![alt](url) when width/height are not provided.
 * Fumadocs-ui's default img uses Next.js Image which requires width and height;
 * markdown image syntax cannot provide these. This override uses unoptimized Image
 * with default dimensions when missing, so external (e.g. GitHub) images work.
 */

"use client";

import Image from "next/image";
import type { ComponentProps } from "react";

const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;

type ImgProps = ComponentProps<typeof Image>;

export function MDXImg(props: ImgProps) {
  const { src, alt = "", width, height, style, ...rest } = props;
  const w = width != null ? Number(width) : DEFAULT_WIDTH;
  const h = height != null ? Number(height) : DEFAULT_HEIGHT;
  const hasExplicitDimensions = width != null && height != null;

  return (
    <Image
      src={src}
      alt={alt}
      width={w}
      height={h}
      unoptimized={!hasExplicitDimensions}
      style={{ maxWidth: "100%", height: "auto", ...style }}
      {...rest}
    />
  );
}

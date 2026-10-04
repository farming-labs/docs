const junctionPositions = ["-left-[5px]", "-right-[5px]"] as const;

export function FrameJunctions() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 -bottom-[5px] z-10 h-[9px]"
    >
      {junctionPositions.map((position) => (
        <span
          key={position}
          className={`absolute top-0 size-[9px] rounded-[2px] border border-black/25 bg-[var(--color-fd-background)] ${position} dark:border-white/25`}
        />
      ))}
    </span>
  );
}

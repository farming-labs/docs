// The docs config reaches the browser as JSON, which drops what React renders from it:
// elements such as icons, components, and callbacks. The server flags a config that has
// any, and the browser restores them from the config module (Farm imports it then).

function isReactValue(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { $$typeof?: unknown }).$$typeof === "symbol"
  );
}

function isUnserializable(value: unknown): boolean {
  return typeof value === "function" || isReactValue(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** True when JSON would lose part of `value`. */
export function hasUnserializableValues(value: unknown, seen = new WeakSet<object>()): boolean {
  if (isUnserializable(value)) return true;
  if (typeof value !== "object" || value === null || seen.has(value)) return false;
  seen.add(value);
  const entries = Array.isArray(value) ? value : isPlainObject(value) ? Object.values(value) : [];
  return entries.some((entry) => hasUnserializableValues(entry, seen));
}

/**
 * The server's JSON copy of the config, with what JSON dropped restored from the config
 * module. Everything serializable keeps the server's value, which carries the routes Farm
 * derived and leaves out server-only fields such as API keys.
 */
export function restoreUnserializableValues(serverValue: unknown, moduleValue: unknown): unknown {
  if (isUnserializable(moduleValue)) return moduleValue;
  if (Array.isArray(serverValue) && Array.isArray(moduleValue)) {
    if (serverValue.length !== moduleValue.length) return serverValue;
    return serverValue.map((entry, index) =>
      restoreUnserializableValues(entry, moduleValue[index]),
    );
  }
  if (isPlainObject(serverValue) && isPlainObject(moduleValue)) {
    const restored: Record<string, unknown> = { ...serverValue };
    for (const [key, value] of Object.entries(moduleValue)) {
      if (key in serverValue) {
        restored[key] = restoreUnserializableValues(serverValue[key], value);
      } else if (hasUnserializableValues(value)) {
        restored[key] = value;
      }
    }
    return restored;
  }
  return serverValue;
}

/** Minimal class joiner. A dependency for this would be 3kB to do what eight
 *  lines do, and it is imported by every component in the app. */
export type ClassValue = string | number | null | undefined | false | ClassValue[];

export function clsx(...parts: ClassValue[]): string {
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (Array.isArray(p)) {
      const nested = clsx(...p);
      if (nested) out.push(nested);
    } else {
      out.push(String(p));
    }
  }
  return out.join(" ");
}

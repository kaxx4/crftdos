"use client";

/** Replaces PIN auth (removed) with a plain, credential-free mode toggle.
 *  Small trusted-volunteer environment — anyone can switch, no gate. Persisted
 *  in localStorage purely so a refresh doesn't reset it; it is a UI
 *  convenience, not an access control. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "./clsx";

const ROLES = [
  { href: "/pos", label: "Volunteer", key: "volunteer" },
  { href: "/", label: "Kiosk", key: "kiosk" },
  { href: "/admin", label: "Admin", key: "admin" },
] as const;

const STORAGE_KEY = "stall_os_role";

function roleForPath(pathname: string): (typeof ROLES)[number]["key"] {
  if (pathname.startsWith("/admin")) return "admin";
  if (pathname.startsWith("/pos") || pathname.startsWith("/settings")) return "volunteer";
  return "kiosk";
}

export function RoleSwitcher({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const pathname = usePathname();
  const active = roleForPath(pathname);

  return (
    <nav
      aria-label="Mode"
      className={clsx(
        "inline-flex shrink-0 items-center gap-0.5 rounded-lg border-2 p-0.5 text-xs font-bold",
        tone === "dark" ? "border-white/40 bg-white/10" : "border-[var(--color-ink)] bg-white",
        className
      )}
    >
      {ROLES.map((r) => (
        <Link
          key={r.key}
          href={r.href}
          onClick={() => {
            try {
              window.localStorage.setItem(STORAGE_KEY, r.key);
            } catch {}
          }}
          aria-current={active === r.key ? "page" : undefined}
          className={clsx(
            "tap-target rounded-md px-2 py-1 uppercase tracking-[0.08em] transition-colors duration-[var(--dur-fast)]",
            active === r.key
              ? tone === "dark"
                ? "bg-white text-[var(--color-ink)]"
                : "bg-[var(--color-ink)] text-white"
              : tone === "dark"
                ? "text-white/80"
                : "text-[var(--color-muted)]"
          )}
        >
          {r.label}
        </Link>
      ))}
    </nav>
  );
}

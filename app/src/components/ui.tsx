import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Panel({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <div
      className={`bg-white p-2.5 flex flex-col gap-2.5 border-2 ${
        accent ? "border-blue" : "border-ink"
      }`}
    >
      {children}
    </div>
  );
}

export function PanelLabel({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <div
      className="font-extrabold text-[10px] tracking-[0.14em] uppercase"
      style={color ? { color } : undefined}
    >
      {children}
    </div>
  );
}

export function Field(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`border-2 border-ink p-3 text-base min-h-[48px] bg-white w-full ${
        props.className ?? ""
      }`}
    />
  );
}

export function BigButton({
  variant = "blue",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "blue" | "ink" | "ghost" | "cream" }) {
  const styles: Record<string, string> = {
    blue: "bg-blue text-cream border-ink",
    ink: "bg-ink text-cream border-ink",
    cream: "bg-cream text-ink border-ink",
    ghost: "bg-transparent text-ink border-ink",
  };
  return (
    <button
      {...props}
      className={`border-2 font-extrabold text-sm tracking-[0.08em] min-h-[52px] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
    />
  );
}

export function Chip({
  active,
  danger,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; danger?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={active}
      className={`border-2 px-3 py-2 min-h-[44px] font-bold text-xs tracking-wide cursor-pointer transition-colors ${
        danger
          ? "border-signal text-signal bg-white"
          : active
          ? "bg-ink text-cream border-ink"
          : "bg-white text-ink border-ink"
      } ${(props.className as string) ?? ""}`}
    />
  );
}

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono text-[11px] text-neutral-600 ${className}`}>{children}</span>;
}

export function CropCorner() {
  return (
    <>
      <span className="absolute top-1 left-1 w-2.5 h-2.5 border-t-2 border-l-2 border-current opacity-70" />
      <span className="absolute top-1 right-1 w-2.5 h-2.5 border-t-2 border-r-2 border-current opacity-70" />
    </>
  );
}

export function Banner({ children, tone = "signal" }: { children: ReactNode; tone?: "signal" | "blue" }) {
  return (
    <div
      className={`px-3.5 py-2 font-extrabold text-[11px] tracking-[0.1em] uppercase flex justify-between gap-2 ${
        tone === "signal" ? "bg-signal text-cream" : "bg-blue text-cream"
      }`}
    >
      {children}
    </div>
  );
}

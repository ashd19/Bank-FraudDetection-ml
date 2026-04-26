import { cn } from "../lib/utils";

export function Card({ className, ...props }) {
  return (
    <div
      className={cn("rounded-3xl border border-border bg-card shadow-panel", className)}
      {...props}
    />
  );
}

export function Button({ className, variant = "default", ...props }) {
  const variants = {
    default: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-accent text-accent-foreground hover:opacity-90",
    ghost: "bg-transparent text-foreground hover:bg-accent",
  };

  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition placeholder:text-muted-foreground focus:border-slate-900",
        className
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm outline-none transition focus:border-slate-900",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, tone = "default", children }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    high: "bg-rose-100 text-rose-700",
    medium: "bg-amber-100 text-amber-700",
    low: "bg-emerald-100 text-emerald-700",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

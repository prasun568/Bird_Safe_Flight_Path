import { SelectHTMLAttributes } from "react";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={joinClasses(
        "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-aviation-400/60 focus:ring-2 focus:ring-aviation-400/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

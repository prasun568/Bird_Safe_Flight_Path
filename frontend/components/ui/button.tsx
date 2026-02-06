import { ButtonHTMLAttributes, forwardRef } from "react";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={joinClasses(
        "inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-aviation-400/70 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
        "bg-gradient-to-r from-sky-300 via-cyan-400 to-sky-500 text-slate-950 shadow-[0_16px_44px_rgba(56,189,248,0.3)] hover:scale-[1.015] hover:brightness-110 hover:shadow-[0_20px_56px_rgba(56,189,248,0.45)] active:scale-[0.99]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

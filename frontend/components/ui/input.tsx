import { InputHTMLAttributes, forwardRef } from "react";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, type = "text", ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={joinClasses(
        "w-full rounded-2xl border border-white/10 bg-slate-950/65 px-4 py-3 text-sm text-slate-100 outline-none transition duration-200 placeholder:text-slate-500 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/20",
        className,
      )}
      {...props}
    />
  );
});

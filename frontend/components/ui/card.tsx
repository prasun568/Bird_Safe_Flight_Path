import { HTMLAttributes } from "react";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={joinClasses("glass-panel rounded-3xl", className)} {...props} />;
}

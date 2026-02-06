import { InputHTMLAttributes } from "react";

function joinClasses(...classes: Array<string | undefined | false>) {
  return classes.filter(Boolean).join(" ");
}

export function Slider({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={joinClasses(
        "aviation-slider h-3 w-full cursor-pointer appearance-none rounded-full",
        className,
      )}
      {...props}
    />
  );
}

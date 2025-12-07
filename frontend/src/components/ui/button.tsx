import * as React from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "outline" | "ghost";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantClass =
      variant === "outline"
        ? "border border-slate-600 bg-transparent hover:bg-slate-800"
        : variant === "ghost"
          ? "bg-transparent hover:bg-slate-800"
          : "bg-slate-100 text-slate-950 hover:bg-slate-200";

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300 disabled:cursor-not-allowed disabled:opacity-50",
          variantClass,
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";

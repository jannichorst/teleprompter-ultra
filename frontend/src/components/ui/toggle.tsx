import * as React from "react";
import { cn } from "../../lib/utils";

type ToggleProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pressed?: boolean;
};

export const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({ className, pressed = false, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        aria-pressed={pressed}
        className={cn(
          "inline-flex items-center rounded-md border border-slate-700 px-3 py-2 text-sm font-medium transition-colors",
          pressed ? "bg-slate-100 text-slate-950" : "bg-slate-900 text-foreground hover:bg-slate-800",
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Toggle.displayName = "Toggle";

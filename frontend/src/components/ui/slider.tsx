import * as React from "react";
import { cn } from "../../lib/utils";

type SliderProps = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  className?: string;
};

export function Slider({ value, min = 0, max = 100, step = 1, onValueChange, className }: SliderProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value))}
      className={cn("h-2 w-full cursor-pointer accent-slate-100", className)}
    />
  );
}

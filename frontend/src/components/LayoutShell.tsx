import { ReactNode } from "react";

export function LayoutShell({ children }: { children: ReactNode }) {
  return <div className="flex h-screen flex-col gap-4 p-4 overflow-hidden md:flex-row md:p-6">{children}</div>;
}

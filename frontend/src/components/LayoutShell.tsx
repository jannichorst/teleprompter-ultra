import { ReactNode } from "react";

export function LayoutShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col gap-4 p-4 md:flex-row md:p-6">{children}</div>;
}

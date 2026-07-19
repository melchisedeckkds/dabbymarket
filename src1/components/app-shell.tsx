import type { ReactNode } from "react";
import { TopBar } from "./top-bar";
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";

export function AppShell({ children, hideTopBar = false }: { children: ReactNode; hideTopBar?: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] bg-background lg:justify-center">
      <SidebarNav />
      <div className="flex min-h-screen w-full max-w-md flex-1 flex-col border-border lg:max-w-2xl lg:border-x">
        {!hideTopBar && (
          <div className="lg:hidden">
            <TopBar />
          </div>
        )}
        <main className="flex-1 pb-24 lg:pb-8">{children}</main>
        <div className="lg:hidden">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}

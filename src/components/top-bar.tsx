import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { Pepite } from "./pepite";
import { Logo } from "./logo";

export function TopBar() {
  const { profile } = useAuth();
  const { unreadCount, t } = useApp();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur">
      <Link to="/" className="flex items-center gap-2">
        <Logo size={34} />
        <span className="text-[17px] font-bold tracking-tight leading-none">
          Dabby<span className="gold-text">Market</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          to="/recharge"
          className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-all hover:bg-primary/20 hover:scale-105"
        >
          <Pepite size={18} />
          <span>{profile?.pepites_balance ?? 0}</span>
        </Link>
        <Link
          to="/messages"
          className="relative grid h-9 w-9 place-items-center rounded-full bg-card text-foreground transition-colors hover:bg-accent"
          aria-label={`${t("nav_messages")} (${unreadCount})`}
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-pop">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

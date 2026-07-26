import { Link, Navigate, useLocation } from "react-router-dom";
import { Store, Map as MapIcon, PlusCircle, MessageCircle, User, ShieldCheck, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useApp } from "@/lib/app-store";
import { Pepite } from "./pepite";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {LogIn} from "lucide-react";
import type { TranslationKey } from "@/lib/i18n";

const NAV: { to: string; key: TranslationKey; icon: typeof Store }[] = [
  { to: "/", key: "nav_marche", icon: Store },
  { to: "/carte", key: "nav_carte", icon: MapIcon },
  { to: "/publier", key: "nav_publier", icon: PlusCircle },
  { to: "/messages", key: "nav_messages", icon: MessageCircle },
  { to: "/compte", key: "nav_compte", icon: User },
];

export function SidebarNav() {
  const path = useLocation().pathname;
  const { profile, signOut } = useAuth();
  const { session } = useAuth();
  const navigate = useNavigate();
  const { unreadCount, t } = useApp();

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-background/60 px-3 py-5 lg:flex xl:w-72">
      <Link to="/" className="flex items-center gap-2 px-2">
        <Logo size={36} />
        <span className="text-lg font-bold tracking-tight leading-none">
          Dabby<span className="gold-text">Market</span>
        </span>
      </Link>

      <Link
        to="/recharge"
        className="mt-6 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary transition-transform hover:scale-[1.02]"
      >
        <Pepite size={20} />
        <span>
          {profile?.pepites_balance ?? 0} {t("pepites")}
        </span>
        <span className="ml-auto text-[10px] font-bold uppercase text-primary/70">{t("nav_recharger")}</span>
      </Link>

      <nav className="mt-6 flex-1 space-y-1">
        {NAV.map(({ to, key, icon: Icon }) => {
          const active = to === "/" ? path === "/" : path.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
              )}
            >
              <Icon size={20} className={cn("transition-transform", active && "scale-110")} />
              {t(key)}
              {to === "/messages" && unreadCount > 0 && (
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {active && <span className="absolute left-0 h-6 w-1 rounded-r-full bg-primary" />}
            </Link>
          );
        })}
        {profile?.is_admin && (
          <Link
            to="/admin"
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              path.startsWith("/admin") ? "bg-primary/10 text-primary" : "text-foreground hover:bg-accent",
            )}
          >
            <ShieldCheck size={20} /> {t("nav_admin")}
          </Link>
        )}
      </nav>

      <div className="mt-auto space-y-1 border-t border-border pt-3">
        <Link to="/compte" className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent">
          <div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full gold-gradient text-sm font-bold">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{profile?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{profile?.phone}</p>
          </div>
        </Link>
        {session ? (
          <button 
            onClick={async () =>{
              await signOut();
              navigate("/auth");
            }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10">
          <LogOut size={18} /> {t("nav_logout")}
        </button>
        ) : (
          <Link
             to="auth"
             className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/10">
              <LogIn size={18} /> {t("nav_login")}
             </Link>
        )}
      </div>
    </aside>
  );
}

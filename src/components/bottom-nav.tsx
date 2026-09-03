import { Link, useLocation } from "react-router-dom";
import { Store, MapPin, Plus, MessageCircle, User, Package, Image as ImageIcon, Sparkles, X, Zap } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/lib/app-store";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

const items: { to: string; key: TranslationKey; icon: typeof Store }[] = [
  { to: "/", key: "nav_marche", icon: Store },
  { to: "/carte", key: "nav_carte", icon: MapPin },
  { to: "/messages", key: "nav_messages", icon: MessageCircle },
  { to: "/compte", key: "nav_compte", icon: User },
];

export function BottomNav() {
  const path = useLocation().pathname;
  const { unreadCount, t } = useApp();
  const [open, setOpen] = useState(false);
  useEscapeToClose(open, () => setOpen(false));

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}
      {open && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 space-y-2 rounded-2xl border border-border bg-card p-2 shadow-2xl">
          <PublishAction to="/vendre-rapidement" icon={Zap} label={t("nav_venteFlash")} onClick={() => setOpen(false)} highlight />
          <PublishAction to="/publier" icon={Package} label={t("publier_title")} onClick={() => setOpen(false)} />
          <PublishAction to="/publier?type=post" icon={ImageIcon} label={t("publier_postTitle")} onClick={() => setOpen(false)} />
          <PublishAction to="/publier?type=vitrine" icon={Sparkles} label={t("publier_vitrineTitle")} onClick={() => setOpen(false)} />
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end">
          {items.slice(0, 2).map((it) => (
            <NavItem key={it.to} to={it.to} label={t(it.key)} Icon={it.icon} active={path === it.to} />
          ))}
          <li className="flex justify-center">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-label={t("nav_publier")}
              className={cn(
                "-mt-6 grid h-14 w-14 place-items-center rounded-full gold-gradient shadow-lg shadow-primary/30 ring-4 ring-background transition-transform",
                open && "rotate-45",
              )}
            >
              {open ? <X size={26} strokeWidth={2.5} /> : <Plus size={26} strokeWidth={2.5} />}
            </button>
          </li>
          {items.slice(2).map((it) => (
            <NavItem
              key={it.to}
              to={it.to}
              label={t(it.key)}
              Icon={it.icon}
              active={path === it.to || path.startsWith(it.to + "/")}
              badge={it.to === "/messages" ? unreadCount : undefined}
            />
          ))}
        </ul>
      </nav>
    </>
  );
}

function NavItem({
  to,
  label,
  Icon,
  active,
  badge,
}: {
  to: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
  badge?: number;
}) {
  return (
    <li>
      <Link
        to={to}
        className={cn(
          "flex flex-col items-center gap-0.5 py-2.5 text-[10.5px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <span className="relative">
          <Icon size={22} strokeWidth={active ? 2.4 : 2} />
          {badge ? (
            <span className="absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

function PublishAction({
  to,
  icon: Icon,
  label,
  onClick,
  highlight,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn("flex min-w-[220px] items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent", highlight && "gold-gradient hover:opacity-90")}
    >
      <span className={cn("grid h-9 w-9 place-items-center rounded-full", highlight ? "bg-background/25" : "bg-primary/15 text-primary")}>
        <Icon size={18} />
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </Link>
  );
}

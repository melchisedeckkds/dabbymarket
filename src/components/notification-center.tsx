import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { useDt } from "@/lib/availability-i18n";
import { useNotificationsRealtime, useUnreadNotificationCount } from "@/lib/availability-queries";

/** Cloche des notifications (distincte de la messagerie) avec compteur de non-lues. */
export function NotificationBell() {
  const dt = useDt();
  const { session } = useAuth();
  const unread = useUnreadNotificationCount();
  if (!session) return null;
  return (
    <Link
      to="/notifications"
      className="relative grid h-9 w-9 place-items-center rounded-full bg-card text-foreground transition-colors hover:bg-accent"
      aria-label={`${dt("n_bell")} (${unread})`}
    >
      <Bell size={18} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-pop">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

/** Écoute temps réel : affiche une alerte discrète à chaque nouvelle notification reçue application ouverte. */
export function NotificationWatcher() {
  const navigate = useNavigate();
  useNotificationsRealtime((n) => {
    toast(n.title, {
      description: n.body ?? undefined,
      action: n.link ? { label: "Voir", onClick: () => navigate(n.link!) } : undefined,
    });
  });
  return null;
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, BellOff, Trash2, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useDt, type DtKey } from "@/lib/availability-i18n";
import { useApp } from "@/lib/app-store";
import { formatAgo, formatXAF } from "@/lib/availability";
import {
  useNotifications, useMarkNotificationsRead, useDeleteNotification, useMyAlerts, useToggleAlert, useDeleteAlert,
  useNotifPrefs, useSaveNotifPrefs, DEFAULT_PREFS, type NotifPrefs,
} from "@/lib/availability-queries";
import { cn } from "@/lib/utils";

type Tab = "inbox" | "alerts" | "prefs";

const PREF_ROWS: { key: keyof NotifPrefs; label: DtKey; group: "customer" | "merchant" }[] = [
  { key: "restock", label: "n_restock", group: "customer" },
  { key: "price_change", label: "n_priceChange", group: "customer" },
  { key: "new_product", label: "n_newProduct", group: "customer" },
  { key: "merchant_reviews", label: "n_merchReviews", group: "merchant" },
  { key: "merchant_reports", label: "n_merchReports", group: "merchant" },
  { key: "merchant_demand", label: "n_merchDemand", group: "merchant" },
  { key: "merchant_reminders", label: "n_merchReminders", group: "merchant" },
];

export default function NotificationsPage() {
  const dt = useDt();
  const { lang } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("inbox");
  const { data: notifs = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationsRead();
  const delNotif = useDeleteNotification();
  const { data: alerts = [] } = useMyAlerts();
  const toggleAlert = useToggleAlert();
  const delAlert = useDeleteAlert();
  const { data: prefs = DEFAULT_PREFS } = useNotifPrefs();
  const savePrefs = useSaveNotifPrefs();
  const unread = notifs.filter((n) => !n.read_at).length;

  async function setPref(patch: Partial<NotifPrefs>) {
    try { await savePrefs.mutateAsync({ ...prefs, ...patch }); toast.success(dt("n_saved")); }
    catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }

  function open(n: (typeof notifs)[number]) {
    if (!n.read_at) markRead.mutate([n.id]);
    if (n.link) navigate(n.link);
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "inbox", label: `${dt("n_title")}${unread ? ` (${unread})` : ""}` },
    { id: "alerts", label: dt("n_alerts") },
    { id: "prefs", label: dt("n_prefs") },
  ];

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card" aria-label={dt("c_back")}><ArrowLeft size={17} /></Link>
          <h1 className="text-lg font-bold">{dt("n_title")}</h1>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-xl bg-card p-1">
          {tabs.map((x) => (
            <button key={x.id} onClick={() => setTab(x.id)} className={cn("rounded-lg py-2 text-[11px] font-bold", tab === x.id ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{x.label}</button>
          ))}
        </div>

        {tab === "inbox" && (
          <>
            {unread > 0 && (
              <button onClick={() => markRead.mutate(undefined)} className="flex items-center gap-1.5 text-xs font-semibold text-primary"><CheckCheck size={14} /> {dt("n_markAll")}</button>
            )}
            {isLoading ? <p className="text-sm text-muted-foreground">{dt("c_loading")}</p> : notifs.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{dt("n_empty")}</p>
            ) : (
              <ul className="space-y-2">
                {notifs.map((n) => (
                  <li key={n.id} className={cn("flex items-start gap-2 rounded-2xl border bg-card p-3", n.read_at ? "border-border opacity-75" : "border-primary/40")}>
                    <button onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-1.5">
                        {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                        <p className="truncate text-sm font-semibold">{n.title}</p>
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
                      <p className="mt-1 text-[10px] text-muted-foreground">{n.audience === "merchant" ? dt("n_merchant") : dt("n_customer")} · {formatAgo(n.created_at, lang)}</p>
                    </button>
                    <button onClick={() => delNotif.mutate(n.id)} aria-label={dt("n_alertDelete")} className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-muted-foreground">{dt("n_pushNote")}</p>
          </>
        )}

        {tab === "alerts" && (
          alerts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{dt("n_noAlerts")}</p>
          ) : (
            <ul className="space-y-2">
              {alerts.map((a) => {
                const label = a.kind === "product" ? a.products?.name : a.kind === "catalog_item" ? (lang === "en" ? a.catalog_items?.name_en : a.catalog_items?.name_fr) : a.query;
                return (
                  <li key={a.id} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{label ?? "—"}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {[a.neighborhood, a.city, a.max_price_xaf ? `${dt("n_alertMaxPrice")} ${formatXAF(a.max_price_xaf)}` : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <button onClick={() => toggleAlert.mutate({ id: a.id, active: !a.active })} className={cn("flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold", a.active ? "bg-primary/15 text-primary" : "bg-accent text-muted-foreground")}>
                      {a.active ? <><Bell size={11} /> {dt("n_alertActive")}</> : <><BellOff size={11} /> {dt("n_alertPaused")}</>}
                    </button>
                    <button onClick={() => delAlert.mutate(a.id)} aria-label={dt("n_alertDelete")} className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground"><Trash2 size={14} /></button>
                  </li>
                );
              })}
            </ul>
          )
        )}

        {tab === "prefs" && (
          <div className="space-y-4">
            {(["customer", "merchant"] as const).map((g) => (
              <section key={g} className="space-y-1.5">
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{g === "customer" ? dt("n_customer") : dt("n_merchant")}</h2>
                {PREF_ROWS.filter((r) => r.group === g).map((r) => (
                  <label key={r.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
                    <span>{dt(r.label)}</span>
                    <input type="checkbox" checked={Boolean(prefs[r.key])} onChange={(e) => setPref({ [r.key]: e.target.checked } as Partial<NotifPrefs>)} className="h-5 w-5 accent-[color:var(--primary)]" />
                  </label>
                ))}
              </section>
            ))}
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
              <span>{dt("n_maxPerDay")}</span>
              <select value={prefs.max_per_day} onChange={(e) => setPref({ max_per_day: Number(e.target.value) })} className="rounded-lg border border-border bg-background px-2 py-1 text-sm">
                {[3, 6, 12, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {savePrefs.isPending && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
          </div>
        )}
      </div>
    </AppShell>
  );
}

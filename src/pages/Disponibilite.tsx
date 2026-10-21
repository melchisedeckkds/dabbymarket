import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Plus, CheckCheck, Loader2, Eye, EyeOff, Minus, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AvailabilityBadge, FreshnessText, ReliabilityChip } from "@/components/availability-badge";
import { useDt } from "@/lib/availability-i18n";
import { useMyShops } from "@/lib/queries";
import {
  useShopCatalog, useSetAvailability, useConfirmProductAvailability, useConfirmShopAvailability, useCreateStockItem, useUpdateStockItem,
  useCategoryOptions, useCategoryRows, useCatalogItems, useShopReliability, useDemandInsights, type ShopProduct,
} from "@/lib/availability-queries";
import { useApp } from "@/lib/app-store";

type Status = "available" | "limited" | "out";

function StatusSwitch({ value, onChange, disabled }: { value: string; onChange: (s: Status) => void; disabled?: boolean }) {
  const dt = useDt();
  const opts: { s: Status; label: string; color: string }[] = [
    { s: "available", label: dt("st_available"), color: "#4caf50" },
    { s: "limited", label: dt("st_limited"), color: "#e0a030" },
    { s: "out", label: dt("st_out"), color: "#d32f2f" },
  ];
  return (
    <div className="grid grid-cols-3 gap-1">
      {opts.map((o) => {
        const active = value === o.s;
        return (
          <button
            key={o.s}
            disabled={disabled}
            onClick={() => onChange(o.s)}
            className="rounded-lg border px-1 py-2 text-[11px] font-bold leading-tight transition-colors disabled:opacity-50"
            style={active ? { borderColor: o.color, background: `${o.color}26`, color: o.color } : { borderColor: "var(--border)" }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ItemRow({ p, shopId }: { p: ShopProduct; shopId: string }) {
  const dt = useDt();
  const set = useSetAvailability();
  const confirm = useConfirmProductAvailability();
  const upd = useUpdateStockItem();
  const [qty, setQty] = useState<number>(p.stock_qty ?? 0);
  const [price, setPrice] = useState(String(p.price_xaf));
  const { data: catalogItems = [] } = useCatalogItems();
  const refPrice = catalogItems.find((c) => c.id === (p as any).catalog_item_id)?.reference_price_xaf ?? null;
  const status: string = p.effective_status ?? "unknown";
  const declared: string = p.availability_status ?? "unknown";
  const busy = set.isPending || confirm.isPending || upd.isPending;

  async function change(s: Status) {
    try {
      await set.mutateAsync({ productId: p.id, shopId, status: s, qty: s === "available" || s === "limited" ? (qty > 0 ? qty : null) : 0 });
    } catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }
  async function savePrice() {
    const n = Number(price);
    if (!n || n === p.price_xaf) return;
    try { await upd.mutateAsync({ productId: p.id, shopId, patch: { price_xaf: n } }); toast.success(dt("m_priceSaved")); }
    catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }

  return (
    <article className="space-y-2.5 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{p.name}</p>
          <FreshnessText confirmedAt={p.confirmed_at ?? p.availability_confirmed_at} status={status} />
        </div>
        <AvailabilityBadge status={status} />
      </div>

      <StatusSwitch value={declared} onChange={change} disabled={busy} />

      {(declared === "available" || declared === "limited") && (
        <div className="flex items-center gap-2">
          {(status === "to_reconfirm" || status === "contested") && (
            <button
              onClick={() => confirm.mutate({ productId: p.id, shopId }, { onError: (e: any) => toast.error(dt("c_error"), { description: e.message }) })}
              disabled={busy}
              className="flex-1 rounded-lg gold-gradient py-2 text-xs font-bold disabled:opacity-50"
            >
              {dt("m_stillThere")}
            </button>
          )}
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-border px-1">
            <button onClick={() => setQty(Math.max(0, qty - 1))} className="grid h-7 w-7 place-items-center" aria-label="-1"><Minus size={13} /></button>
            <input
              inputMode="numeric" value={qty || ""} placeholder="—"
              onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)}
              onBlur={() => qty !== (p.stock_qty ?? 0) && change(declared as Status)}
              className="w-10 bg-transparent text-center text-xs font-semibold outline-none"
            />
            <button onClick={() => { const n = qty + 1; setQty(n); }} className="grid h-7 w-7 place-items-center" aria-label="+1"><Plus size={13} /></button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          inputMode="numeric" value={price}
          onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
          onBlur={savePrice}
          className="w-28 rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold outline-none"
        />
        <span className="text-[11px] text-muted-foreground">FCFA{p.sale_unit ? ` / ${p.sale_unit}` : ""}</span>
        {refPrice && Number(price) > refPrice && (
          <span className="text-[10px] font-semibold text-destructive">Au-dessus du prix de référence ({refPrice.toLocaleString("fr-FR")} FCFA)</span>
        )}
        <button
          onClick={() => upd.mutate({ productId: p.id, shopId, patch: { show_on_map: !(p.show_on_map ?? true) } })}
          className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground"
        >
          {(p.show_on_map ?? true) ? <><EyeOff size={12} /> {dt("m_hideOnMap")}</> : <><Eye size={12} /> {dt("m_showOnMap")}</>}
        </button>
      </div>
    </article>
  );
}

function AddItemSheet({ shopId, onClose }: { shopId: string; onClose: () => void }) {
  const dt = useDt();
  const { lang } = useApp();
  const create = useCreateStockItem();
  const { data: catalog = [] } = useCatalogItems();
  const { data: catRows = [] } = useCategoryRows();
  const cats = useCategoryOptions({ stockOnly: true });
  const [catalogId, setCatalogId] = useState<string>("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");
  const [status, setStatus] = useState<Status>("available");
  const [conditions, setConditions] = useState("");
  const [attrs, setAttrs] = useState<Record<string, string>>({});

  const item = catalog.find((c) => c.id === catalogId);
  const effectiveCat = item?.category_id ?? category;
  const catRow = catRows.find((c) => c.id === effectiveCat);
  const finalName = item ? (lang === "en" ? item.name_en : item.name_fr) : name.trim();
  const attributes = catRow?.attributes ?? [];

  async function save() {
    if (!finalName || !effectiveCat || !Number(price)) return toast.error(dt("c_error"), { description: `${dt("m_name")} / ${dt("m_category")} / ${dt("m_price")}` });
    try {
      await create.mutateAsync({
        shopId, name: finalName, category: effectiveCat, catalogItemId: item?.id ?? null, price: Number(price), status,
        qty: qty ? Number(qty) : null, saleUnit: item?.sale_unit ?? catRow?.units?.[0] ?? null, conditions: conditions.trim() || null, attributes: attrs,
      });
      toast.success(dt("m_saved"));
      onClose();
    } catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }

  return (
    <div className="fixed inset-0 z-[900] flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto max-h-[88vh] w-full max-w-md space-y-3 overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{dt("m_add")}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-accent" aria-label={dt("a_close")}><X size={15} /></button></div>

        <label className="block text-[11px] font-semibold text-muted-foreground">{dt("m_pickCatalog")}
          <select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground">
            <option value="">{dt("m_orCustom")}</option>
            {catalog.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{lang === "en" ? c.name_en : c.name_fr}</option>)}
          </select>
        </label>

        {!item && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={dt("m_name")} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
              <option value="">{dt("m_category")}</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.label}</option>)}
            </select>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder={dt("m_price")} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />
          <input inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} placeholder={dt("m_qty")} className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />
        </div>
        <StatusSwitch value={status} onChange={setStatus} />
        <input value={conditions} onChange={(e) => setConditions(e.target.value.slice(0, 300))} placeholder={dt("m_conditions")} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />

        {attributes.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">{dt("m_attrs")}</p>
            {attributes.map((a) => (
              a.type === "select" ? (
                <select key={a.key} value={attrs[a.key] ?? ""} onChange={(e) => setAttrs({ ...attrs, [a.key]: e.target.value })} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm">
                  <option value="">{lang === "en" ? a.label_en ?? a.label_fr : a.label_fr}</option>
                  {(a.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input key={a.key} type={a.type === "number" ? "number" : "text"} value={attrs[a.key] ?? ""} onChange={(e) => setAttrs({ ...attrs, [a.key]: e.target.value })}
                  placeholder={lang === "en" ? a.label_en ?? a.label_fr : a.label_fr} className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none" />
              )
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground">{dt("m_free")}</p>
        <button onClick={save} disabled={create.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-3 text-sm font-bold disabled:opacity-50">
          {create.isPending && <Loader2 size={15} className="animate-spin" />} {dt("m_save")}
        </button>
      </div>
    </div>
  );
}

export default function DisponibilitePage() {
  const dt = useDt();
  const { data: shops = [], isLoading: loadingShops } = useMyShops();
  const [shopIdSel, setShopIdSel] = useState<string | null>(null);
  const shop = shops.find((s: any) => s.id === shopIdSel) ?? shops[0];
  const { data: catalog = [], isLoading } = useShopCatalog(shop?.id);
  const { data: rel } = useShopReliability(shop?.id);
  const { data: demand = [] } = useDemandInsights(shop?.id);
  const confirmAll = useConfirmShopAvailability();
  const [adding, setAdding] = useState(false);

  // Articles suivis en disponibilité : ceux de type « stock » OU dont un statut a déjà été déclaré.
  const tracked = useMemo(() => catalog.filter((p) => p.listing_kind === "stock" || (p.availability_status && p.availability_status !== "unknown")), [catalog]);
  const stale = tracked.filter((p) => p.effective_status === "to_reconfirm" || p.effective_status === "contested").length;

  async function doConfirmAll() {
    if (!shop) return;
    try { const n = await confirmAll.mutateAsync(shop.id); toast.success(`${n} ${dt("m_confirmAllDone")}`); }
    catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }

  return (
    <AppShell>
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Link to="/compte" className="grid h-9 w-9 place-items-center rounded-full bg-card" aria-label={dt("c_back")}><ArrowLeft size={17} /></Link>
          <div><h1 className="text-lg font-bold">{dt("m_title")}</h1><p className="text-[11px] text-muted-foreground">{dt("m_sub")}</p></div>
        </div>

        {loadingShops ? (
          <p className="text-sm text-muted-foreground">{dt("c_loading")}</p>
        ) : !shop ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-sm text-muted-foreground">{dt("m_noShop")}</p>
            <Link to="/creer-boutique" className="inline-block rounded-xl gold-gradient px-4 py-2.5 text-sm font-bold">{dt("m_createShop")}</Link>
          </div>
        ) : (
          <>
            {shops.length > 1 && (
              <select value={shop.id} onChange={(e) => setShopIdSel(e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-semibold">
                {shops.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            {shop.shop_type !== "physical" && <p className="rounded-xl bg-accent p-3 text-xs text-muted-foreground">{dt("m_noPhysical")}</p>}

            <div className="flex flex-wrap items-center gap-2"><ReliabilityChip level={rel?.level} /></div>

            <div className="flex gap-2">
              <button onClick={doConfirmAll} disabled={confirmAll.isPending || tracked.length === 0} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 py-3 text-xs font-bold text-primary disabled:opacity-40">
                {confirmAll.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} {dt("m_confirmAll")}
              </button>
              <button onClick={() => setAdding(true)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl gold-gradient py-3 text-xs font-bold"><Plus size={14} /> {dt("m_add")}</button>
            </div>

            {stale > 0 ? (
              <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{stale} {dt("m_toReconfirmBanner")}</p>
            ) : tracked.length > 0 ? (
              <p className="rounded-xl bg-[color:var(--verified)]/10 px-3 py-2 text-xs font-semibold text-[color:var(--verified)]">{dt("m_allFresh")}</p>
            ) : null}

            {isLoading ? <p className="text-sm text-muted-foreground">{dt("c_loading")}</p> : tracked.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">{dt("m_empty")}</p>
            ) : (
              <div className="space-y-2.5">{tracked.map((p) => <ItemRow key={p.id} p={p} shopId={shop.id} />)}</div>
            )}

            <section className="space-y-2">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><TrendingUp size={15} className="text-primary" /> {dt("m_demand")}</h2>
              {demand.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">{dt("m_demandNone")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {demand.map((d) => (
                    <li key={`${d.catalog_item_id}-${d.term}`} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs">
                      <span className="font-semibold">{d.term}</span>
                      <span className="text-muted-foreground">{d.searchers} {dt("m_demandPeople")}{d.waiting_alerts > 0 ? ` · ${d.waiting_alerts} ${dt("m_demandWaiting")}` : ""}{!d.in_catalog ? ` · ${dt("m_demandAdd")}` : ""}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
      {adding && shop && <AddItemSheet shopId={shop.id} onClose={() => setAdding(false)} />}
    </AppShell>
  );
}

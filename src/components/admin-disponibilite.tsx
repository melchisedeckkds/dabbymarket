import { useMemo, useState } from "react";
import { Plus, Pencil, X, Trash2, Loader2, EyeOff, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAppConfig } from "@/lib/queries";
import { useDt } from "@/lib/availability-i18n";
import {
  useCategoryRows, useCatalogItems, useAdminSaveCategory, useAdminSaveCatalogItem, useAdminReviews, useAdminSetReviewStatus,
  type CategoryRow, type CategoryAttribute, type CatalogItem,
} from "@/lib/availability-queries";
import { cn } from "@/lib/utils";

const RULE_KEYS: { key: string; label: string }[] = [
  { key: "availability_default_ttl_hours", label: "Validité d'une confirmation (heures, défaut global)" },
  { key: "availability_contest_threshold", label: "Signalants « épuisé » pour contester une disponibilité" },
  { key: "availability_contest_window_hours", label: "Fenêtre des signalements (heures)" },
  { key: "report_min_account_age_hours", label: "Ancienneté minimale pour signaler (heures)" },
  { key: "review_min_account_age_hours", label: "Ancienneté minimale pour noter (heures)" },
  { key: "review_daily_limit", label: "Avis maximum par utilisateur et par jour" },
  { key: "review_report_hide_threshold", label: "Signalants masquant automatiquement un avis" },
  { key: "max_stock_items_per_shop", label: "Articles de disponibilité maximum par boutique" },
  { key: "stock_items_count_toward_quota", label: "Compter ces articles dans le quota gratuit (1 = oui, 0 = non)" },
  { key: "trouvailles_min_reviews", label: "Avis minimum pour figurer dans les Trouvailles" },
  { key: "demand_alert_threshold", label: "Chercheurs distincts déclenchant l'alerte « forte demande »" },
  { key: "demand_k_anonymity", label: "Seuil d'anonymat des statistiques de demande" },
  { key: "notify_max_per_day_default", label: "Plafond de notifications clients par jour (défaut)" },
  { key: "notify_followers_cap", label: "Abonnés notifiés au maximum par nouvel article" },
];

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{title}</h3>{action}</div>
      {children}
    </section>
  );
}

// ---------- Règles ----------
function RulesSection() {
  const dt = useDt();
  const qc = useQueryClient();
  const { data: cfg = {} } = useAppConfig();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function save(key: string) {
    const raw = draft[key];
    const n = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(n) || n < 0) return toast.error(dt("c_error"));
    setSaving(key);
    const { error } = await supabase.rpc("admin_update_config", { p_key: key, p_value: n });
    setSaving(null);
    if (error) return toast.error(dt("c_error"), { description: error.message });
    toast.success(dt("a_saved"));
    setDraft((d) => { const c = { ...d }; delete c[key]; return c; });
    qc.invalidateQueries({ queryKey: ["app-config"] });
  }

  return (
    <Section title={dt("a_rules")}>
      <p className="text-[11px] text-muted-foreground">{dt("a_ruleHint")}</p>
      <div className="space-y-1.5">
        {RULE_KEYS.map((r) => {
          const current = cfg[r.key];
          const value = draft[r.key] ?? (current == null ? "" : String(current));
          return (
            <div key={r.key} className="flex items-center gap-2 rounded-xl border border-border bg-card p-2.5">
              <span className="min-w-0 flex-1 text-[11px]">{r.label}</span>
              <input inputMode="numeric" value={value} onChange={(e) => setDraft({ ...draft, [r.key]: e.target.value.replace(/\D/g, "") })} className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center text-xs font-bold outline-none" />
              <button onClick={() => save(r.key)} disabled={draft[r.key] === undefined || saving === r.key} className="rounded-lg gold-gradient px-2.5 py-1 text-[11px] font-bold disabled:opacity-30">
                {saving === r.key ? <Loader2 size={12} className="animate-spin" /> : dt("a_save")}
              </button>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ---------- Catégories ----------
type CatDraft = Omit<CategoryRow, "created_at" | "updated_at"> & { isNew?: boolean; unitsText: string };

function blankCategory(): CatDraft {
  return { id: "", parent_id: null, name_fr: "", name_en: "", description: "", icon: "Package", sort_order: 100, active: true, ttl_hours: null, is_regulated: false, allow_stock: true, units: [], unitsText: "", attributes: [], isNew: true };
}

function CategoryEditor({ draft, onClose, rows }: { draft: CatDraft; onClose: () => void; rows: CategoryRow[] }) {
  const dt = useDt();
  const save = useAdminSaveCategory();
  const [d, setD] = useState<CatDraft>(draft);
  const parents = rows.filter((r) => r.id !== d.id && r.parent_id !== d.id);

  function setAttr(i: number, patch: Partial<CategoryAttribute>) {
    setD({ ...d, attributes: d.attributes.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
  }

  async function submit() {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(d.id) || !d.name_fr.trim() || !d.name_en.trim()) return toast.error(dt("c_error"), { description: dt("a_id") });
    const attrs = d.attributes.filter((a) => a.key.trim() && a.label_fr.trim()).map((a) => ({ ...a, key: a.key.trim(), options: a.type === "select" ? a.options ?? [] : undefined }));
    try {
      await save.mutateAsync({
        id: d.id, parent_id: d.parent_id || null, name_fr: d.name_fr.trim(), name_en: d.name_en.trim(), description: d.description || null,
        icon: d.icon || null, sort_order: d.sort_order, active: d.active, ttl_hours: d.ttl_hours, is_regulated: d.is_regulated, allow_stock: d.allow_stock,
        units: d.unitsText.split(",").map((u) => u.trim()).filter(Boolean), attributes: attrs,
      });
      toast.success(dt("a_saved"));
      onClose();
    } catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }

  const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none";
  return (
    <div className="fixed inset-0 z-[900] flex items-end bg-background/70 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="mx-auto max-h-[90vh] w-full max-w-md space-y-2 overflow-y-auto rounded-t-3xl border-t border-border bg-card p-4">
        <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{d.isNew ? dt("a_add") : dt("a_edit")}</h3><button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full bg-accent"><X size={15} /></button></div>
        <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_id")}<input disabled={!d.isNew} value={d.id} onChange={(e) => setD({ ...d, id: e.target.value.toLowerCase() })} className={cn(inp, "mt-0.5 disabled:opacity-50")} /></label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_nameFr")}<input value={d.name_fr} onChange={(e) => setD({ ...d, name_fr: e.target.value })} className={cn(inp, "mt-0.5")} /></label>
          <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_nameEn")}<input value={d.name_en} onChange={(e) => setD({ ...d, name_en: e.target.value })} className={cn(inp, "mt-0.5")} /></label>
        </div>
        <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_parent")}
          <select value={d.parent_id ?? ""} onChange={(e) => setD({ ...d, parent_id: e.target.value || null })} className={cn(inp, "mt-0.5")}>
            <option value="">{dt("a_noParent")}</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.parent_id ? "— " : ""}{p.name_fr}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="block text-[10px] font-semibold text-muted-foreground">Icône<input value={d.icon ?? ""} onChange={(e) => setD({ ...d, icon: e.target.value })} className={cn(inp, "mt-0.5")} /></label>
          <label className="block text-[10px] font-semibold text-muted-foreground">Ordre<input inputMode="numeric" value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value.replace(/\D/g, "")) || 0 })} className={cn(inp, "mt-0.5")} /></label>
          <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_ttl")}<input inputMode="numeric" placeholder={dt("a_ttlDefault")} value={d.ttl_hours ?? ""} onChange={(e) => setD({ ...d, ttl_hours: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null })} className={cn(inp, "mt-0.5")} /></label>
        </div>
        <label className="block text-[10px] font-semibold text-muted-foreground">{dt("a_units")}<input value={d.unitsText} onChange={(e) => setD({ ...d, unitsText: e.target.value })} className={cn(inp, "mt-0.5")} /></label>
        <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold">
          {([["active", "a_active"], ["allow_stock", "a_allowStock"], ["is_regulated", "a_regulated"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-1.5 rounded-lg border border-border p-2"><input type="checkbox" checked={Boolean(d[k])} onChange={(e) => setD({ ...d, [k]: e.target.checked })} /> {dt(l)}</label>
          ))}
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between"><p className="text-[11px] font-bold">{dt("a_attrs")}</p>
            <button onClick={() => setD({ ...d, attributes: [...d.attributes, { key: "", label_fr: "", type: "text" }] })} className="text-[11px] font-bold text-primary">+ {dt("a_attrAdd")}</button></div>
          {d.attributes.map((a, i) => (
            <div key={i} className="space-y-1 rounded-lg border border-border p-2">
              <div className="grid grid-cols-3 gap-1">
                <input placeholder={dt("a_attrKey")} value={a.key} onChange={(e) => setAttr(i, { key: e.target.value.replace(/[^a-z0-9_]/gi, "").toLowerCase() })} className={inp} />
                <input placeholder={dt("a_attrLabel")} value={a.label_fr} onChange={(e) => setAttr(i, { label_fr: e.target.value, label_en: a.label_en || e.target.value })} className={inp} />
                <select value={a.type} onChange={(e) => setAttr(i, { type: e.target.value as CategoryAttribute["type"] })} className={inp}><option value="text">texte</option><option value="number">nombre</option><option value="select">liste</option></select>
              </div>
              {a.type === "select" && <input placeholder={dt("a_attrOptions")} value={(a.options ?? []).join(", ")} onChange={(e) => setAttr(i, { options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) })} className={inp} />}
              <button onClick={() => setD({ ...d, attributes: d.attributes.filter((_, idx) => idx !== i) })} className="flex items-center gap-1 text-[10px] text-destructive"><Trash2 size={10} /> {dt("a_remove")}</button>
            </div>
          ))}
        </div>
        <button onClick={submit} disabled={save.isPending} className="flex w-full items-center justify-center gap-2 rounded-xl gold-gradient py-2.5 text-sm font-bold disabled:opacity-50">{save.isPending && <Loader2 size={14} className="animate-spin" />} {dt("a_save")}</button>
      </div>
    </div>
  );
}

function CategoriesSection() {
  const dt = useDt();
  const { data: rows = [] } = useCategoryRows();
  const [editing, setEditing] = useState<CatDraft | null>(null);
  const ordered = useMemo(() => {
    const top = rows.filter((r) => !r.parent_id);
    const out: { row: CategoryRow; depth: number }[] = [];
    const walk = (r: CategoryRow, depth: number) => { out.push({ row: r, depth }); rows.filter((c) => c.parent_id === r.id).forEach((c) => walk(c, depth + 1)); };
    top.forEach((r) => walk(r, 0));
    return out;
  }, [rows]);

  return (
    <Section title={dt("a_categories")} action={<button onClick={() => setEditing(blankCategory())} className="flex items-center gap-1 rounded-lg gold-gradient px-2.5 py-1 text-[11px] font-bold"><Plus size={12} /> {dt("a_add")}</button>}>
      <div className="space-y-1.5">
        {ordered.map(({ row, depth }) => (
          <div key={row.id} style={{ marginLeft: depth * 14 }} className={cn("flex items-center gap-2 rounded-xl border border-border bg-card p-2.5", !row.active && "opacity-50")}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold">{row.name_fr} <span className="font-normal text-muted-foreground">· {row.id}</span></p>
              <p className="text-[10px] text-muted-foreground">
                {row.ttl_hours ? `${row.ttl_hours} h` : dt("a_ttlDefault")}{row.is_regulated ? ` · ${dt("a_regulated")}` : ""}{!row.allow_stock ? " · stock fermé" : ""}{row.attributes.length ? ` · ${row.attributes.length} attr.` : ""}
              </p>
            </div>
            <button onClick={() => setEditing({ ...row, unitsText: (row.units ?? []).join(", ") })} className="grid h-8 w-8 place-items-center rounded-full bg-accent" aria-label={dt("a_edit")}><Pencil size={13} /></button>
          </div>
        ))}
      </div>
      {editing && <CategoryEditor key={editing.id || "new"} draft={editing} rows={rows} onClose={() => setEditing(null)} />}
    </Section>
  );
}

// ---------- Catalogue de référence ----------
function CatalogSection() {
  const dt = useDt();
  const { data: items = [] } = useCatalogItems();
  const { data: cats = [] } = useCategoryRows();
  const save = useAdminSaveCatalogItem();
  const [edit, setEdit] = useState<(Partial<CatalogItem> & { synonymsText?: string }) | null>(null);

  async function submit() {
    if (!edit) return;
    if (!edit.slug || !edit.category_id || !edit.name_fr || !edit.name_en) return toast.error(dt("c_error"));
    try {
      await save.mutateAsync({
        id: edit.id, slug: edit.slug, category_id: edit.category_id, name_fr: edit.name_fr, name_en: edit.name_en,
        sale_unit: edit.sale_unit ?? null, synonyms: (edit.synonymsText ?? "").split(",").map((s) => s.trim()).filter(Boolean), active: edit.active ?? true,
      } as any);
      toast.success(dt("a_saved"));
      setEdit(null);
    } catch (e: any) { toast.error(dt("c_error"), { description: e.message }); }
  }
  const inp = "w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs outline-none";

  return (
    <Section title={dt("a_catalog")} action={<button onClick={() => setEdit({ active: true, synonymsText: "" })} className="flex items-center gap-1 rounded-lg gold-gradient px-2.5 py-1 text-[11px] font-bold"><Plus size={12} /> {dt("a_add")}</button>}>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.id} className={cn("flex items-center gap-2 rounded-xl border border-border bg-card p-2.5", !i.active && "opacity-50")}>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">{i.name_fr}</p><p className="text-[10px] text-muted-foreground">{i.category_id} · {i.slug}</p></div>
            <button onClick={() => setEdit({ ...i, synonymsText: (i.synonyms ?? []).join(", ") })} className="grid h-8 w-8 place-items-center rounded-full bg-accent"><Pencil size={13} /></button>
          </div>
        ))}
      </div>
      {edit && (
        <div className="space-y-2 rounded-2xl border border-primary/30 bg-card p-3">
          <input placeholder={dt("a_slug")} disabled={!!edit.id} value={edit.slug ?? ""} onChange={(e) => setEdit({ ...edit, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={cn(inp, "disabled:opacity-50")} />
          <select value={edit.category_id ?? ""} onChange={(e) => setEdit({ ...edit, category_id: e.target.value })} className={inp}><option value="">{dt("m_category")}</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name_fr}</option>)}</select>
          <div className="grid grid-cols-2 gap-2"><input placeholder={dt("a_nameFr")} value={edit.name_fr ?? ""} onChange={(e) => setEdit({ ...edit, name_fr: e.target.value })} className={inp} /><input placeholder={dt("a_nameEn")} value={edit.name_en ?? ""} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} className={inp} /></div>
          <input placeholder={dt("m_unit")} value={edit.sale_unit ?? ""} onChange={(e) => setEdit({ ...edit, sale_unit: e.target.value })} className={inp} />
          <input placeholder={dt("a_synonyms")} value={edit.synonymsText ?? ""} onChange={(e) => setEdit({ ...edit, synonymsText: e.target.value })} className={inp} />
          <label className="flex items-center gap-1.5 text-[11px] font-semibold"><input type="checkbox" checked={edit.active ?? true} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> {dt("a_active")}</label>
          <div className="flex gap-2"><button onClick={() => setEdit(null)} className="flex-1 rounded-lg border border-border py-2 text-xs font-semibold">{dt("m_cancel")}</button><button onClick={submit} className="flex-1 rounded-lg gold-gradient py-2 text-xs font-bold">{dt("a_save")}</button></div>
        </div>
      )}
    </Section>
  );
}

// ---------- Avis masqués ----------
function ReviewsSection() {
  const dt = useDt();
  const { data: reviews = [] } = useAdminReviews();
  const setStatus = useAdminSetReviewStatus();
  return (
    <Section title={dt("a_reviews")}>
      {reviews.length === 0 ? <p className="text-[11px] text-muted-foreground">{dt("a_noHidden")}</p> : (
        <div className="space-y-1.5">
          {reviews.map((r: any) => (
            <div key={r.id} className="space-y-1 rounded-xl border border-border bg-card p-2.5 text-xs">
              <p className="font-bold">{r.products?.name ?? "—"} · {r.rating}/5 · <span className="text-muted-foreground">{r.profiles?.name ?? "—"}</span> · <span className="uppercase text-destructive">{r.status}</span></p>
              {r.comment && <p className="text-muted-foreground">{r.comment}</p>}
              <div className="flex gap-2">
                <button onClick={() => setStatus.mutate({ reviewId: r.id, status: "visible" })} className="flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-[11px] font-semibold"><RotateCcw size={11} /> {dt("a_restore")}</button>
                {r.status !== "removed" && <button onClick={() => setStatus.mutate({ reviewId: r.id, status: "removed" })} className="flex items-center gap-1 rounded-lg border border-destructive/40 px-2 py-1 text-[11px] font-semibold text-destructive"><EyeOff size={11} /> {dt("a_remove")}</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function AdminDisponibiliteTab() {
  return (
    <div className="space-y-6">
      <CategoriesSection />
      <CatalogSection />
      <ReviewsSection />
      <RulesSection />
    </div>
  );
}

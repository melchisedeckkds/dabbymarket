import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Phone, BadgeCheck, Store, Heart, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useApp } from "@/lib/app-store";
import { useUserProfile, useUserShops, useUserPosts, useShopRatingsMap } from "@/lib/queries";
import { ShopHeaderSkeleton } from "@/components/skeletons";
import { maskPhone } from "@/lib/utils";

export default function ProfilPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useApp();
  const locale = lang === "en" ? "en-US" : "fr-FR";
  const { data: profile, isLoading } = useUserProfile(id);
  const { data: shops = [] } = useUserShops(id);
  const { data: posts = [] } = useUserPosts(id);
  const { data: ratings } = useShopRatingsMap(shops.map((s: any) => s.id));

  if (isLoading) {
    return <ShopHeaderSkeleton />;
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">{t("profil_notFound")}</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 px-4 pt-3">
        <Link to="/" className="grid h-9 w-9 place-items-center rounded-full bg-card">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-bold">{t("profil_title")}</h1>
      </div>

      <div className="p-4">
        <div className="rounded-2xl border border-border bg-card p-4 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full gold-gradient text-2xl font-bold">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <h2 className="mt-3 text-base font-bold">{profile.name}</h2>
          <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <Phone size={12} /> {maskPhone(profile.phone)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("profil_memberSince")} {new Date(profile.created_at).toLocaleDateString(locale, { month: "long", year: "numeric" })}
          </p>
        </div>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Store size={15} className="text-primary" /> {t("profil_shops")} ({shops.length})
          </h3>
          {shops.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("profil_noShops")}</p>
          ) : (
            <div className="space-y-2">
              {shops.map((s: any) => {
                const r = ratings?.get(s.id);
                return (
                  <Link key={s.id} to={`/boutique/${s.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                    <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-accent text-xl">
                      {s.logo_url ? <img src={s.logo_url} alt="" className="h-full w-full object-cover" /> : "🏪"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{s.name}</span>
                        {s.verified && <BadgeCheck size={13} className="shrink-0 fill-[color:var(--verified)] text-background" />}
                      </div>
                      {r && (
                        <span className="text-[11px] text-muted-foreground">
                          ⭐ {r.avg} ({r.count})
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <MessageCircle size={15} className="text-primary" /> {t("profil_posts")} ({posts.length})
          </h3>
          {posts.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">{t("profil_noPosts")}</p>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((p: any) => (
                <Link key={p.id} to={`/?post=${p.id}`} className="relative aspect-square overflow-hidden rounded-lg border border-border bg-accent">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <p className="line-clamp-4 p-1.5 text-[9px] leading-tight text-muted-foreground">{p.text}</p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

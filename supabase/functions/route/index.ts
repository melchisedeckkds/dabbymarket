// Fonction Edge Supabase — itinéraire (Lot 0 DabbyMap).
//
// Le navigateur n'appelle plus un serveur d'itinéraires public : il appelle cette fonction,
// qui (1) exige un utilisateur connecté (JWT), (2) valide les coordonnées, (3) n'autorise que
// les zones où la navigation est ouverte (geo_zones.navigation_enabled), (4) interroge le
// moteur que vous configurez, puis renvoie sa réponse telle quelle (format OSRM).
//
// Déploiement :
//   supabase secrets set ROUTING_BASE_URL=https://votre-moteur.exemple.com   (compatible OSRM, sans "/" final)
//   supabase functions deploy route
// Sans ROUTING_BASE_URL, la fonction répond 503 et l'application affiche une ligne approximative.
// ⚠️ N'utilisez PAS router.project-osrm.org (serveur de démonstration, usage commercial non garanti).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });

const PROFILES = new Set(["foot", "driving", "bike"]);
// Rectangle large autour du Cameroun : écarte les valeurs aberrantes.
const inCameroon = (p: { lat: number; lng: number }) =>
  Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= 1.6 && p.lat <= 13.2 && p.lng >= 8.4 && p.lng <= 16.3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const { profile, from, to } = body ?? {};
  if (!PROFILES.has(profile) || !from || !to || !inCameroon(from) || !inCameroon(to)) {
    return json({ error: "bad_request" }, 400);
  }

  const base = (Deno.env.get("ROUTING_BASE_URL") ?? "").replace(/\/+$/, "");
  if (!base) return json({ error: "routing_unavailable" }, 503);

  // La navigation doit être ouverte pour la zone de départ ET d'arrivée.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: user } = await supabase.auth.getUser();
  if (!user?.user) return json({ error: "unauthorized" }, 401);
  for (const p of [from, to]) {
    const { data: zoneId } = await supabase.rpc("map_zone_for", { p_lat: p.lat, p_lng: p.lng });
    if (!zoneId) return json({ error: "zone_not_open" }, 422);
    const { data: zone } = await supabase.from("geo_zones").select("navigation_enabled").eq("id", zoneId).maybeSingle();
    // La zone la plus précise peut être un quartier : on remonte à sa ville si besoin.
    if (!zone?.navigation_enabled) return json({ error: "zone_not_open" }, 422);
  }

  try {
    const url = `${base}/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return json({ error: "router_error", status: res.status }, 502);
    return json(await res.json());
  } catch {
    return json({ error: "router_unreachable" }, 502);
  }
});

// Mesure manuelle de l'acquisition, sans outil externe : on mémorise
// utm_source / utm_campaign / ref présents dans le lien d'arrivée, puis on
// les rattache une seule fois au compte à la première connexion.
// Aucune donnée personnelle : uniquement l'origine du lien.
import { supabase } from "./supabase";

const KEY = "dm_attribution";

export function captureAttribution() {
  try {
    const p = new URLSearchParams(window.location.search);
    const source = p.get("utm_source") || p.get("src");
    const campaign = p.get("utm_campaign") || p.get("campaign");
    const ref = p.get("ref");
    if ((source || campaign || ref) && !localStorage.getItem(KEY)) {
      localStorage.setItem(KEY, JSON.stringify({ source, campaign, ref }));
    }
  } catch { /* stockage indisponible : on ignore */ }
}

export async function sendAttribution() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const a = JSON.parse(raw);
    const { error } = await supabase.rpc("record_acquisition", { p_source: a.source, p_campaign: a.campaign, p_ref: a.ref });
    if (!error) localStorage.removeItem(KEY);
  } catch { /* non bloquant */ }
}

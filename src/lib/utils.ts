import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { COUNTRY_CODES } from "./country-codes";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Masque un numéro de téléphone par souci de confidentialité : seul
 * l'indicatif du pays reste visible (ex. "+237 •• •• •• ••"). On
 * recherche l'indicatif le plus long qui correspond, pour ne pas
 * confondre par exemple +23 avec +237.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const match = [...COUNTRY_CODES].sort((a, b) => b.dial.length - a.dial.length).find((c) => phone.startsWith(c.dial));
  const dial = match?.dial ?? phone.slice(0, 4);
  const rest = phone.slice(dial.length).replace(/\D/g, "");
  const groups = Math.max(2, Math.ceil(rest.length / 2));
  return `${dial} ${Array.from({ length: groups }, () => "••").join(" ")}`;
}

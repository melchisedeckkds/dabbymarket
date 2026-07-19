import { useEffect } from "react";

/**
 * Ferme une fenêtre superposée (modale, bottom sheet, menu) quand
 * l'utilisateur appuie sur Échap — comportement attendu sur ordinateur,
 * sans effet sur mobile où il n'y a pas de clavier physique.
 */
export function useEscapeToClose(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, onClose]);
}

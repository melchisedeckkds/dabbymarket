import { motion } from "framer-motion";
import logoClair from "@/assets/mon-logo-clair.png";

/**
 * Premier écran vu par l'utilisateur à l'ouverture de l'app, pendant 3
 * secondes fixes (voir App.tsx) — toujours sur fond clair nuancé or, même
 * si l'utilisateur a choisi le mode nuit, pour un effet de marque cohérent
 * façon "écran d'accueil" d'application native.
 */
export function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center"
      style={{ background: "radial-gradient(circle at 50% 40%, #fbf3df 0%, #f7ecd1 45%, #f0dfb0 100%)" }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center gap-4"
      >
        <img src={logoClair} alt="DabbyMarket" className="h-24 w-24 rounded-xl object-contain shadow-xl shadow-primary/20" />
        <span className="text-2xl font-bold tracking-tight text-[#1a1204]">
          Dabby<span className="gold-text">Market</span>
        </span>
      </motion.div>
    </motion.div>
  );
}

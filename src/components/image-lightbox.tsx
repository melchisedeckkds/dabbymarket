import { motion, AnimatePresence } from "framer-motion";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";

/**
 * Affiche une image en plein écran, fond flouté, fermeture par clic en
 * dehors, par la touche Échap, ou en la faisant glisser verticalement
 * (glisser-déposer façon Stories) — inspiré d'Instagram.
 */
export function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEscapeToClose(true, onClose);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[950] flex items-center justify-center bg-background/90 p-4 backdrop-blur-md"
        onClick={onClose}
      >
        <motion.img
          src={src}
          alt={alt ?? ""}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={0.85}
          onDragEnd={(_, info) => {
            if (Math.abs(info.offset.y) > 120 || Math.abs(info.velocity.y) > 500) onClose();
          }}
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[88vh] max-w-[92vw] cursor-grab touch-none rounded-xl object-contain shadow-2xl active:cursor-grabbing"
        />
      </motion.div>
    </AnimatePresence>
  );
}

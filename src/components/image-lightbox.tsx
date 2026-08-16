import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle } from "lucide-react";
import { useEscapeToClose } from "@/hooks/use-escape-to-close";
import { HashtagText } from "./hashtag-text";

/**
 * Affiche une image en plein écran, fond flouté, fermeture par clic en
 * dehors, par la touche Échap, ou en la faisant glisser verticalement
 * (glisser-déposer façon Stories) — inspiré d'Instagram.
 *
 * Peut aussi porter les informations d'une publication (légende, likes,
 * commentaires) pour servir de vue détaillée complète — utilisé à la
 * fois au clic dans le fil et pour le lien profond depuis un profil.
 */
export function ImageLightbox({
  src,
  alt,
  onClose,
  caption,
  authorName,
  likesCount,
  commentsCount,
  onOpenComments,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
  caption?: string;
  authorName?: string;
  likesCount?: number;
  commentsCount?: number;
  onOpenComments?: () => void;
}) {
  useEscapeToClose(true, onClose);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[950] flex flex-col items-center justify-center gap-3 bg-background/90 p-4 backdrop-blur-md"
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
          className="max-h-[70vh] max-w-[92vw] cursor-grab touch-none rounded-xl object-contain shadow-2xl active:cursor-grabbing"
        />

        {(caption || likesCount !== undefined || commentsCount !== undefined) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[92vw] rounded-2xl border border-border bg-card/95 p-3.5 shadow-xl sm:max-w-sm"
          >
            {caption && (
              <p className="text-[15px] text-foreground/90">
                {authorName && <span className="mr-1.5 font-semibold">{authorName}</span>}
                <HashtagText text={caption} className="font-caption" />
              </p>
            )}
            {(likesCount !== undefined || commentsCount !== undefined) && (
              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                {likesCount !== undefined && (
                  <span className="flex items-center gap-1">
                    <Heart size={13} className="fill-current" /> {likesCount}
                  </span>
                )}
                {commentsCount !== undefined && (
                  <button onClick={onOpenComments} className="flex items-center gap-1">
                    <MessageCircle size={13} /> {commentsCount}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}


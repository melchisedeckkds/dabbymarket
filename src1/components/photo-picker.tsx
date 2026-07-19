import { useRef, useState } from "react";
import { X, ImagePlus } from "lucide-react";
import { compressImage } from "@/lib/image";
import { useApp } from "@/lib/app-store";

export type PickedPhoto = { file: File; preview: string };

export function PhotoPicker({
  photos,
  onChange,
  max = 5,
}: {
  photos: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  max?: number;
}) {
  const { t } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  async function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const remaining = max - photos.length;
    const toAdd = Array.from(fileList).slice(0, remaining);
    setCompressing(true);
    try {
      const compressed = await Promise.all(toAdd.map((f) => compressImage(f)));
      const next = [...photos, ...compressed.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
      onChange(next);
    } finally {
      setCompressing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    const next = photos.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p, i) => (
          <div key={p.preview} className="relative aspect-square overflow-hidden rounded-xl border border-border">
            <img src={p.preview} alt="" className="h-full w-full object-cover" />
            {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">{t("photoPicker_main")}</span>}
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-background/80 backdrop-blur"
              aria-label={t("photoPicker_removeAlt")}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={compressing}
            className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <div className="text-center">
              <ImagePlus size={20} className="mx-auto" />
              <p className="mt-1 text-[10px] font-medium">{compressing ? t("photoPicker_optimizing") : t("photoPicker_add")}</p>
            </div>
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
      <p className="mt-1.5 text-[11px] text-muted-foreground">
        {photos.length}/{max} {t("photoPicker_hint")}
      </p>
    </div>
  );
}

/**
 * Compresse une image côté navigateur avant upload (redimensionnement +
 * réencodage JPEG). Réduit fortement la consommation de données et
 * l'espace de stockage — important pour le mode "données réduites" de
 * DabbyMarket sur les connexions lentes/coûteuses au Cameroun.
 */
export async function compressImage(file: File, maxDimension?: number, quality?: number): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  // Si l'appelant ne précise pas de valeurs explicites, on applique le mode
  // "données réduites" choisi par l'utilisateur dans Compte → Paramètres
  // (activé par défaut) : images plus petites et plus compressées.
  const dataSaverOn = localStorage.getItem("dm-data-saver") !== "0";
  const effectiveMaxDimension = maxDimension ?? (dataSaverOn ? 1000 : 1600);
  const effectiveQuality = quality ?? (dataSaverOn ? 0.65 : 0.85);

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  let { width, height } = bitmap;
  if (width > effectiveMaxDimension || height > effectiveMaxDimension) {
    const ratio = Math.min(effectiveMaxDimension / width, effectiveMaxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", effectiveQuality));
  if (!blob) return file;

  // Si la compression n'apporte rien (petite image déjà légère), garder l'original
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export async function compressImages(files: File[], maxDimension?: number, quality?: number): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxDimension, quality)));
}

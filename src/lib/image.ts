/**
 * Compresse une image côté navigateur avant upload (redimensionnement +
 * réencodage JPEG). Réduit fortement la consommation de données et
 * l'espace de stockage — important pour le mode "données réduites" de
 * DabbyMarket sur les connexions lentes/coûteuses au Cameroun.
 */
export async function compressImage(file: File, maxDimension = 1280, quality = 0.78): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;

  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) return file;

  // Si la compression n'apporte rien (petite image déjà légère), garder l'original
  if (blob.size >= file.size) return file;

  const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], newName, { type: "image/jpeg" });
}

export async function compressImages(files: File[], maxDimension?: number, quality?: number): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxDimension, quality)));
}

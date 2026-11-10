export type AvatarStyle = { skin: string; hair: string; shirt: string; style: "short" | "long" | "none" };
export const defaultAvatar: AvatarStyle = { skin: "#d99568", hair: "#241811", shirt: "#17623e", style: "short" };
export type Visuals = { crest: string | null; players: Record<string, { photo: string | null; avatar: AvatarStyle | null }> };

export async function prepareImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error("Elige una imagen JPG, PNG o WebP de hasta 8 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    const size = 192;
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size);
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const width = bitmap.width * scale, height = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - width) / 2, (size - height) / 2, width, height);
    return canvas.toDataURL("image/jpeg", 0.8);
  } finally { bitmap.close(); }
}

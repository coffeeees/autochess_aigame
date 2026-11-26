// 내보내기용 그림 줄이기(v0.26.1). 관리자에 올린 원본(최대 10MB PNG)을 그대로 담으면 ZIP이 수백 MB가 되어
// 대화창에 올릴 수 없으므로, 게임에서 보이는 크기에 맞춰 WebP로 다시 담는다(가져오기 도구도 어차피 WebP로 바꾼다).
// - 캐릭터·배경: 긴 변 최대 2048px, 썸네일: 최대 1024px, WebP 품질 0.92(투명도 유지).
// - 프레임·이름표: 원본 디자인 그대로 두는 그림이라 2MB 이하면 원본 그대로, 더 크면 최고 품질 WebP.
// - 다시 담은 것이 더 크거나 브라우저가 WebP를 못 만들면 원본 그대로. 브라우저에 저장된 원본은 바꾸지 않는다.
import type { CardImageSlot, StoredImage } from '../core/card-settings.ts';

export const exportLimits = {
  maxSide: { character: 2048, background: 2048, thumbnail: 1024 } as Record<string, number>,
  quality: 0.92,
  keepOriginalUpTo: 2 * 1024 * 1024, // 프레임·이름표는 이 크기까지 원본 그대로
};

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
}

export async function compressForExport(
  slot: CardImageSlot,
  img: StoredImage,
): Promise<StoredImage> {
  const design = slot === 'frame' || slot === 'nameplate';
  if (design && img.size <= exportLimits.keepOriginalUpTo) return img;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(img.blob);
  } catch {
    return img;
  }
  const maxSide = design ? Infinity : (exportLimits.maxSide[slot] ?? 2048);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return img;
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await toBlob(canvas, design ? 1 : exportLimits.quality);
  if (!blob || blob.type !== 'image/webp' || blob.size >= img.size) return img;
  return { blob, format: 'webp', name: img.name, size: blob.size, width, height };
}

/**
 * 인게임 썸네일 줄인 사본(v0.26.8, 관리자 미리보기용). 게임 반영본(가져오기 도구의 Lanczos 사본)과 같은 너비로,
 * 반씩 여러 번 줄여 한 번에 크게 줄일 때 생기는 자글거림을 피한다. 원본보다 작은 너비만 만든다.
 */
export async function thumbnailVariantBlobs(
  blob: Blob,
  widths: readonly number[],
): Promise<{ width: number; blob: Blob }[]> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return [];
  }
  const out: { width: number; blob: Blob }[] = [];
  for (const w of widths) {
    if (w >= bitmap.width) continue;
    let src: CanvasImageSource = bitmap;
    let sw = bitmap.width;
    let sh = bitmap.height;
    const h = Math.max(1, Math.round((bitmap.height * w) / bitmap.width));
    while (true) {
      const nw = sw / 2 >= w ? Math.round(sw / 2) : w;
      const nh = sw / 2 >= w ? Math.round(sh / 2) : h;
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) break;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, nw, nh);
      src = canvas;
      sw = nw;
      sh = nh;
      if (nw === w) {
        const b = await toBlob(canvas, exportLimits.quality);
        if (b) out.push({ width: w, blob: b });
        break;
      }
    }
  }
  const width = bitmap.width;
  bitmap.close();
  return out.filter((x) => x.width < width);
}

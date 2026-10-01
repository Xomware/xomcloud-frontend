// Seeded so the grain, and any screenshot of it, is the same on every load.
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let r = Math.imul(s ^ (s >>> 15), 1 | s);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// A 128px film-grain tile as a data URL, for a background-image the grain layer jitters.
export function grainTile(): string {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const rand = rng(7);
  for (let i = 0; i < size * size; i++) {
    const v = rand() * 255;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 22;
  }
  ctx.putImageData(img, 0, 0);
  return c.toDataURL();
}

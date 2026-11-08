// Cuts out a product photo's background by flood-filling inward from the
// image edges: works well for the typical case of a product shot on a
// plain (even if unevenly lit/shadowed) backdrop. No external service or
// API key needed.
//
// Each pixel is compared to the *neighbor* that reached it (region
// growing), not to one fixed background color — so a soft lighting
// gradient or shadow across the backdrop gets absorbed step by step,
// while a hard edge against the product still stops the fill. A looser
// bound against the original seed color prevents the fill from slowly
// drifting into unrelated colors over a long chain of small steps.
export async function removeImageBackground(
  file: File,
  options?: { stepThreshold?: number; seedThreshold?: number; maxDimension?: number }
): Promise<Blob> {
  const stepThreshold = options?.stepThreshold ?? 26;
  const seedThreshold = options?.seedThreshold ?? 90;
  const maxDimension = options?.maxDimension ?? 1600;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // Estimate the seed background color from a strip of pixels around the
  // whole border (not just the 4 corners), so one shadowed corner doesn't
  // skew the estimate.
  let seedR = 0;
  let seedG = 0;
  let seedB = 0;
  let seedCount = 0;
  const sampleStep = Math.max(1, Math.floor(Math.min(width, height) / 60));
  for (let x = 0; x < width; x += sampleStep) {
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4;
      seedR += data[i];
      seedG += data[i + 1];
      seedB += data[i + 2];
      seedCount++;
    }
  }
  for (let y = 0; y < height; y += sampleStep) {
    for (const x of [0, width - 1]) {
      const i = (y * width + x) * 4;
      seedR += data[i];
      seedG += data[i + 1];
      seedB += data[i + 2];
      seedCount++;
    }
  }
  seedR /= seedCount;
  seedG /= seedCount;
  seedB /= seedCount;

  const dist = (i: number, r: number, g: number, b: number) => {
    const dr = data[i] - r;
    const dg = data[i + 1] - g;
    const db = data[i + 2] - b;
    return Math.sqrt(dr * dr + dg * dg + db * db);
  };

  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let queueLength = 0;

  const tryEnqueue = (x: number, y: number, parentI: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (dist(i, data[parentI], data[parentI + 1], data[parentI + 2]) > stepThreshold) return;
    if (dist(i, seedR, seedG, seedB) > seedThreshold) return;
    visited[p] = 1;
    queue[queueLength++] = p;
  };

  // Seed every border pixel that's reasonably close to the estimated
  // background color.
  const distToSeed = (i: number) => dist(i, seedR, seedG, seedB);
  const tryEnqueueBorder = (x: number, y: number) => {
    const p = y * width + x;
    if (visited[p]) return;
    const i = p * 4;
    if (distToSeed(i) > seedThreshold) return;
    visited[p] = 1;
    queue[queueLength++] = p;
  };
  for (let x = 0; x < width; x++) {
    tryEnqueueBorder(x, 0);
    tryEnqueueBorder(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryEnqueueBorder(0, y);
    tryEnqueueBorder(width - 1, y);
  }

  let head = 0;
  while (head < queueLength) {
    const p = queue[head++];
    const x = p % width;
    const y = (p - x) / width;
    const parentI = p * 4;
    tryEnqueue(x + 1, y, parentI);
    tryEnqueue(x - 1, y, parentI);
    tryEnqueue(x, y + 1, parentI);
    tryEnqueue(x, y - 1, parentI);
  }

  for (let p = 0; p < width * height; p++) {
    if (visited[p]) data[p * 4 + 3] = 0;
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not process the image."));
    }, "image/png");
  });
}

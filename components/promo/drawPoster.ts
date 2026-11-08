const WIDTH = 1080;
const HEIGHT = 1080;

export type PosterInput = {
  productName: string;
  productImageUrl: string | null;
  retailPrice: number;
  discountPrice: number;
  currencySymbol: string;
  shopName: string;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${src}`));
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function money(symbol: string, value: number): string {
  return `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function drawPoster(canvas: HTMLCanvasElement, input: PosterInput): Promise<void> {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Background: diagonal brand gradient.
  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#0f172a");
  bg.addColorStop(0.55, "#1e3a8a");
  bg.addColorStop(1, "#1d4ed8");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Soft radial glow behind the product area.
  const glow = ctx.createRadialGradient(WIDTH / 2, 480, 60, WIDTH / 2, 480, 420);
  glow.addColorStop(0, "rgba(255,255,255,0.18)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Logo (top-right).
  if (input.logoUrl) {
    try {
      const logo = await loadImage(input.logoUrl);
      const maxW = 180;
      const maxH = 100;
      const scale = Math.min(maxW / logo.width, maxH / logo.height);
      const w = logo.width * scale;
      const h = logo.height * scale;
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      roundRect(ctx, WIDTH - w - 60, 40, w + 20, h + 20, 12);
      ctx.fill();
      ctx.drawImage(logo, WIDTH - w - 50, 50, w, h);
      ctx.restore();
    } catch {
      // logo failed to load — skip it rather than failing the whole poster
    }
  }

  // Product name (top-left, wrapped).
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = "700 56px system-ui, -apple-system, Segoe UI, sans-serif";
  const nameLines = wrapText(ctx, input.productName.toUpperCase(), 620).slice(0, 3);
  let nameY = 120;
  for (const line of nameLines) {
    ctx.fillText(line, 60, nameY);
    nameY += 62;
  }

  // Product image (centered).
  const imgBoxTop = nameY + 20;
  const imgBoxHeight = 480;
  if (input.productImageUrl) {
    try {
      const product = await loadImage(input.productImageUrl);
      const maxW = 560;
      const maxH = imgBoxHeight;
      const scale = Math.min(maxW / product.width, maxH / product.height);
      const w = product.width * scale;
      const h = product.height * scale;
      const x = (WIDTH - w) / 2;
      const y = imgBoxTop + (imgBoxHeight - h) / 2;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.4)";
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;
      ctx.drawImage(product, x, y, w, h);
      ctx.restore();
    } catch {
      // product image failed to load — leave the space empty
    }
  }

  // "SAVE Rs. X" badge (top-left of the price area).
  const save = Math.max(0, input.retailPrice - input.discountPrice);
  const priceAreaTop = imgBoxTop + imgBoxHeight + 20;

  if (save > 0) {
    ctx.save();
    ctx.fillStyle = "#dc2626";
    roundRect(ctx, 60, priceAreaTop, 280, 90, 14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 24px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText("SAVE", 84, priceAreaTop + 34);
    ctx.font = "800 32px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillStyle = "#fde047";
    ctx.fillText(money(input.currencySymbol, save), 84, priceAreaTop + 72);
    ctx.restore();
  }

  // Retail price (struck through) and discount price.
  const priceX = save > 0 ? 380 : 60;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 32px system-ui, -apple-system, Segoe UI, sans-serif";
  const retailText = money(input.currencySymbol, input.retailPrice);
  ctx.fillText(retailText, priceX, priceAreaTop + 30);
  const retailWidth = ctx.measureText(retailText).width;
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(priceX, priceAreaTop + 20);
  ctx.lineTo(priceX + retailWidth, priceAreaTop + 20);
  ctx.stroke();

  ctx.fillStyle = "#fde047";
  ctx.font = "800 56px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(money(input.currencySymbol, input.discountPrice), priceX, priceAreaTop + 82);

  // Bottom contact bar.
  const barHeight = 140;
  const barTop = HEIGHT - barHeight;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, barTop, WIDTH, barHeight);
  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font = "700 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.shopName, 60, barTop + 42);

  ctx.font = "400 22px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  const contactParts = [input.phone, input.email].filter(Boolean) as string[];
  ctx.fillText(contactParts.join("   •   "), 60, barTop + 78);

  // Payment badges (bottom-right).
  ctx.save();
  ctx.font = "700 20px system-ui, -apple-system, Segoe UI, sans-serif";
  const visaText = "VISA";
  const mcText = "Mastercard";
  const mcWidth = ctx.measureText(mcText).width;
  const visaWidth = ctx.measureText(visaText).width;
  const badgeGap = 14;
  const mcBoxW = mcWidth + 28;
  const visaBoxW = visaWidth + 28;
  let bx = WIDTH - 60 - mcBoxW;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, bx, barTop + 52, mcBoxW, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(mcText, bx + 14, barTop + 79);

  bx -= badgeGap + visaBoxW;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, bx, barTop + 52, visaBoxW, 40, 8);
  ctx.fill();
  ctx.fillStyle = "#1a1a2e";
  ctx.fillText(visaText, bx + 14, barTop + 79);
  ctx.restore();
}

export function downloadCanvasPng(canvas: HTMLCanvasElement, filename: string) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, "image/png");
}

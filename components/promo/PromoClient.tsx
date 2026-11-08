"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useCurrencySymbol } from "@/components/providers/CurrencyProvider";
import { drawPoster, downloadCanvasPng } from "./drawPoster";

type Part = {
  id: string;
  name: string;
  sku: string | null;
  sell_price: number;
  retail_price: number;
  image_url: string | null;
};

type ShopSettings = {
  shop_name: string;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
};

export default function PromoClient({ parts, settings }: { parts: Part[]; settings: ShopSettings }) {
  const currency = useCurrencySymbol();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [search, setSearch] = useState("");
  const [selectedPart, setSelectedPart] = useState<Part | null>(null);
  const [retailPrice, setRetailPrice] = useState("");
  const [discountPrice, setDiscountPrice] = useState("");
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  const filteredParts = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return parts.filter((p) => p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)).slice(0, 8);
  }, [search, parts]);

  function selectPart(p: Part) {
    setSelectedPart(p);
    setSearch("");
    setRetailPrice(String(p.retail_price || p.sell_price || 0));
    setDiscountPrice(String(p.sell_price || 0));
  }

  const retailNum = Number(retailPrice) || 0;
  const discountNum = Number(discountPrice) || 0;
  const saveAmount = Math.max(0, retailNum - discountNum);

  useEffect(() => {
    if (!selectedPart || !canvasRef.current) return;
    let cancelled = false;
    setRendering(true);
    setRenderError(null);
    drawPoster(canvasRef.current, {
      productName: selectedPart.name,
      productImageUrl: selectedPart.image_url,
      retailPrice: retailNum,
      discountPrice: discountNum,
      currencySymbol: currency,
      shopName: settings.shop_name,
      phone: settings.phone,
      email: settings.email,
      logoUrl: settings.logo_url,
    })
      .catch((err) => {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : "Could not render the poster.");
      })
      .finally(() => {
        if (!cancelled) setRendering(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPart, retailNum, discountNum, currency, settings]);

  function handleDownload() {
    if (!canvasRef.current || !selectedPart) return;
    downloadCanvasPng(canvasRef.current, `${selectedPart.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-promo.png`);
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Promo Images</h1>
      <p className="text-sm text-slate-500">
        Generate a branded social-media promo image for a product. Set the regular and discounted price, then
        download it as a PNG ready to post.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="relative">
              <label className="text-xs text-slate-500 block mb-1">Product</label>
              <input
                value={selectedPart ? `${selectedPart.name}${selectedPart.sku ? ` (${selectedPart.sku})` : ""}` : search}
                onChange={(e) => {
                  setSelectedPart(null);
                  setSearch(e.target.value);
                }}
                placeholder="Search product by name or SKU…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              {!selectedPart && filteredParts.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
                  {filteredParts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => selectPart(p)}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-100 last:border-0 flex items-center justify-between"
                    >
                      <span>
                        {p.name} {p.sku && <span className="text-slate-400">({p.sku})</span>}
                      </span>
                      {!p.image_url && <span className="text-[10px] text-amber-600 shrink-0 ml-2">no photo</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedPart && !selectedPart.image_url && (
              <div className="rounded-lg bg-amber-50 text-amber-700 text-xs px-3 py-2">
                This product has no photo yet. Add one from the Products page (Edit → Product photo) for the
                best-looking poster — the image area will stay empty until then.
              </div>
            )}

            {selectedPart && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Retail price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={retailPrice}
                    onChange={(e) => setRetailPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Discount price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountPrice}
                    onChange={(e) => setDiscountPrice(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div className="col-span-2 text-sm text-slate-600">
                  Customer saves {currency}
                  {saveAmount.toFixed(2)}
                </div>
              </div>
            )}
          </div>

          {selectedPart && (
            <button
              onClick={handleDownload}
              disabled={rendering}
              className="rounded-lg bg-blue-600 text-white font-semibold px-5 py-2.5 text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {rendering ? "Rendering…" : "Download PNG"}
            </button>
          )}

          {renderError && <div className="rounded-lg bg-red-50 text-red-700 text-sm px-4 py-3">{renderError}</div>}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-center">
          {selectedPart ? (
            <canvas ref={canvasRef} className="w-full max-w-[480px] aspect-square rounded-lg border border-slate-100" />
          ) : (
            <div className="text-sm text-slate-400 text-center py-16">Search for a product to preview its promo image.</div>
          )}
        </div>
      </div>
    </div>
  );
}

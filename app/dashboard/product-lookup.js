"use client";

import { useEffect, useRef, useState } from "react";
import { Barcode, Search, QrCode, Camera, X } from "lucide-react";
import HealthAssessment from "../pantry/[id]/health-assessment";

export default function ProductLookup({ onFound }) {
  const [mode, setMode] = useState("barcode");
  const [barcode, setBarcode] = useState("");
  const [qrInput, setQrInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [foundProduct, setFoundProduct] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Stop the camera whenever scanning ends or this component unmounts.
  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    let frameId;
    let detector;
    let stream;

    async function startScanner() {
      try {
        if (!("BarcodeDetector" in window)) {
          setCameraError(
            "Camera QR scanning is not supported by this browser. Paste the QR product link below instead.",
          );
          setScanning(false);
          return;
        }

        detector = new window.BarcodeDetector({
          formats: ["qr_code"],
        });

        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        async function detect() {
          if (cancelled || !videoRef.current) return;

          try {
            const codes = await detector.detect(videoRef.current);

            if (codes.length && codes[0].rawValue) {
              const value = codes[0].rawValue;
              stopScanner();
              openProductLink(value);
              return;
            }
          } catch {
            // Keep scanning if a single frame cannot be decoded.
          }

          if (!cancelled) {
            frameId = requestAnimationFrame(detect);
          }
        }

        detect();
      } catch {
        if (!cancelled) {
          setCameraError(
            "Could not access the camera. Allow camera permission or paste the QR product link below.",
          );
          setScanning(false);
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      if (frameId) cancelAnimationFrame(frameId);

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [scanning]);

  function stopScanner() {
    setScanning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function openProductLink(value) {
    setError("");

    try {
      const trimmed = value.trim();

      // Accept a full URL or a relative path such as /pantry/PRODUCT_ID.
      const url = new URL(trimmed, window.location.origin);

      // Only allow product pages on this application.
      if (
        url.origin !== window.location.origin ||
        !/^\/pantry\/[^/]+\/?$/.test(url.pathname)
      ) {
        throw new Error(
          "This QR code is not a valid SmartPantry product link.",
        );
      }

      window.location.assign(url.href);
    } catch (err) {
      setError(err.message || "Enter a valid SmartPantry QR product link.");
    }
  }

  async function lookup(e) {
    e.preventDefault();
    setError("");

    const value = barcode.trim();

    if (!/^[0-9]{8,14}$/.test(value)) {
      setError("Enter a barcode containing 8–14 digits.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(value)}`,
        { cache: "no-store" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Product not found.");
      }

      setFoundProduct(data.product);
      onFound?.(data.product);
      setBarcode("");
    } catch (err) {
      setError(
        err.message || "Lookup failed. You can add the product manually.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-xl bg-cream p-1">
        <button
          type="button"
          onClick={() => {
            stopScanner();
            setMode("barcode");
            setError("");
            setCameraError("");
          }}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold ${
            mode === "barcode"
              ? "bg-white text-ink shadow-sm"
              : "text-slate-600"
          }`}
        >
          <Barcode size={17} />
          Packaged food
        </button>

        <button
          type="button"
          onClick={() => {
            setMode("qr");
            setError("");
            setCameraError("");
          }}
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold ${
            mode === "qr" ? "bg-white text-ink shadow-sm" : "text-slate-600"
          }`}
        >
          <QrCode size={17} />
          Grocery QR
        </button>
      </div>

      {mode === "barcode" && (
        <>
          <form onSubmit={lookup} className="space-y-2">
            <div className="flex gap-2">
              <label htmlFor="barcode" className="sr-only">
                Barcode
              </label>

              <div className="relative min-w-0 flex-1">
                <Barcode
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  id="barcode"
                  inputMode="numeric"
                  autoComplete="off"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Enter product barcode"
                  className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3 outline-none focus:border-leaf"
                />
              </div>

              <button
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                <Search size={17} />
                <span className="hidden sm:inline">
                  {loading ? "Looking…" : "Look up"}
                </span>
              </button>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Uses Open Food Facts when available. Always verify package
              details; barcode lookup does not provide the package expiry date.
            </p>
          </form>

          {foundProduct && (
            <div className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{foundProduct.name}</h3>
                  <p className="text-xs text-slate-500">
                    {foundProduct.brand || "Brand not listed"} · Data: Open Food
                    Facts
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFoundProduct(null)}
                  className="text-xs font-semibold text-slate-500"
                >
                  Close
                </button>
              </div>

              {foundProduct.ingredients && (
                <p className="mt-2 text-sm text-slate-600">
                  <strong>Ingredients:</strong> {foundProduct.ingredients}
                </p>
              )}

              {Array.isArray(foundProduct.allergens) &&
                foundProduct.allergens.length > 0 && (
                  <p className="mt-2 text-sm text-amber-800">
                    <strong>Listed allergens:</strong>{" "}
                    {foundProduct.allergens.join(", ")}
                  </p>
                )}

              <HealthAssessment
                product={{
                  name: foundProduct.name,
                  category: foundProduct.category || "other",
                  nutrition_notes: foundProduct.nutrition_notes || "",
                  price: foundProduct.price || 0,
                  barcode: foundProduct.barcode,
                }}
                onRemoveFromList={() => setFoundProduct(null)}
              />
            </div>
          )}
        </>
      )}

      {mode === "qr" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-2">
              <QrCode size={20} className="text-leaf" />
              <h3 className="font-bold">Scan a grocery-owner QR code</h3>
            </div>

            <p className="mt-2 text-sm text-slate-600">
              Scan the QR label displayed by a SmartPantry grocery owner to open
              that product's details, expiry information and health assessment.
            </p>

            {!scanning ? (
              <button
                type="button"
                onClick={() => {
                  setCameraError("");
                  setError("");
                  setScanning(true);
                }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-white"
              >
                <Camera size={18} />
                Open camera scanner
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="aspect-video w-full rounded-xl bg-black object-cover"
                />

                <button
                  type="button"
                  onClick={stopScanner}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-3 font-semibold"
                >
                  <X size={17} />
                  Stop camera
                </button>
              </div>
            )}

            {cameraError && (
              <p role="alert" className="mt-3 text-sm text-amber-800">
                {cameraError}
              </p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              openProductLink(qrInput);
            }}
            className="space-y-2"
          >
            <label htmlFor="qr-product-link" className="text-sm font-semibold">
              Or paste the product QR link
            </label>

            <input
              id="qr-product-link"
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="https://your-domain.com/pantry/..."
              autoComplete="url"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 outline-none focus:border-leaf"
            />

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 font-semibold text-white"
            >
              <Search size={17} />
              Open grocery product
            </button>

            <p className="text-xs leading-5 text-slate-500">
              Only SmartPantry product links on this same website are accepted.
              A valid QR code must point to a /pantry/PRODUCT_ID page.
            </p>
          </form>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

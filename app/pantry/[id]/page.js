import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import HealthAssessment from "./health-assessment";
import {
  Leaf,
  Store,
  ArrowLeft,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";

export const dynamic = "force-dynamic";

function getExpiryStatus(expiryDate, expiryType) {
  if (!expiryDate || expiryType === "unknown") {
    return {
      label: "Expiry unknown",
      description: "No reliable expiry date is available for this product.",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  // Compare calendar dates, not timestamps.
  const today = new Date();
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const expiry = new Date(`${expiryDate}T00:00:00`);

  if (Number.isNaN(expiry.getTime())) {
    return {
      label: "Expiry date unavailable",
      description: "The saved expiry date could not be interpreted.",
      className: "border-slate-200 bg-slate-50 text-slate-700",
    };
  }

  const daysRemaining = Math.round(
    (expiry.getTime() - todayDate.getTime()) / 86400000,
  );

  if (daysRemaining < 0) {
    return {
      label: "Date has passed",
      description:
        expiryType === "printed"
          ? "The recorded printed date has passed. Check the label and food safety guidance before use."
          : "The recorded estimated freshness date has passed. Inspect carefully and follow food safety guidance.",
      className: "border-red-200 bg-red-50 text-red-800",
    };
  }

  if (daysRemaining <= 3) {
    return {
      label:
        daysRemaining === 0
          ? "Date is today"
          : `Within ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      description:
        expiryType === "estimated"
          ? "The estimated freshness date is approaching; actual freshness may vary."
          : "The recorded date is approaching. Check the package instructions.",
      className: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  return {
    label: "Date not approaching",
    description:
      expiryType === "estimated"
        ? "This is an estimated freshness date, not a guarantee of freshness."
        : "The recorded date is more than three days away. Store the product according to its label.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
}

export default async function PantryProductPage({ params }) {
  const { id } = await params;
  let product = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("pantry_products")
      .select(
        "id,name,category,price,unit,nutrition_notes,source_type,created_at,expiry_date,expiry_type",
      )
      .eq("id", id)
      .eq("active", true)
      .maybeSingle();

    if (!error) product = data;
  } catch {
    // Show the not-found state below if the database is unavailable.
  }

  if (!product) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="rounded-2xl bg-white p-8 shadow-soft">
          <h1 className="text-xl font-extrabold">Product not found</h1>
          <p className="mt-2 text-slate-600">
            The QR may be old or the product may have been deactivated.
          </p>
          <Link
            href="/"
            className="mt-4 inline-flex items-center gap-2 font-bold text-leaf"
          >
            <ArrowLeft size={16} /> SmartPantry AI home
          </Link>
        </div>
      </main>
    );
  }

  const expiryType = product.expiry_type || "unknown";
  const expiryStatus = getExpiryStatus(product.expiry_date, expiryType);

  const formattedExpiry = product.expiry_date
    ? new Intl.DateTimeFormat("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${product.expiry_date}T00:00:00Z`))
    : null;

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-extrabold"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-leaf">
            <Leaf size={20} />
          </span>
          SmartPantry <span className="text-leaf">AI</span>
        </Link>

        <section className="mt-6 rounded-3xl bg-white p-5 shadow-soft sm:p-8">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-mint p-3 text-leaf">
              <Store size={22} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-wide text-leaf">
                Grocery owner registered product
              </p>
              <h1 className="mt-1 break-words text-3xl font-extrabold">
                {product.name}
              </h1>
              <p className="mt-1 capitalize text-slate-500">
                {product.category || "Other"} · Sold by {product.unit}
                {Number(product.price) > 0
                  ? ` · ₹${Number(product.price).toFixed(2)}`
                  : ""}
              </p>
            </div>
          </div>

          {/* Expiry and freshness information */}
          <div
            className={`mt-5 rounded-2xl border p-4 ${expiryStatus.className}`}
          >
            <div className="flex items-start gap-3">
              {expiryStatus.label === "Date has passed" ? (
                <AlertTriangle className="mt-0.5 shrink-0" size={21} />
              ) : (
                <CalendarClock className="mt-0.5 shrink-0" size={21} />
              )}
              <div>
                <h2 className="font-bold">{expiryStatus.label}</h2>
                {formattedExpiry && (
                  <p className="mt-1 text-sm">
                    {expiryType === "estimated"
                      ? "Estimated freshness date"
                      : "Recorded expiry / use-by date"}
                    : {formattedExpiry}
                  </p>
                )}
                <p className="mt-1 text-sm leading-5">
                  {expiryStatus.description}
                </p>
                <p className="mt-2 text-xs">
                  Date type:{" "}
                  {expiryType === "printed"
                    ? "Printed on package"
                    : expiryType === "estimated"
                      ? "Estimated by the seller"
                      : "Unknown"}
                </p>
              </div>
            </div>
          </div>

          {product.nutrition_notes && (
            <p className="mt-5 rounded-xl bg-cream p-3 text-sm">
              <strong>Owner notes:</strong> {product.nutrition_notes}
            </p>
          )}

          <p className="mt-4 text-sm leading-6 text-slate-600">
            This product was registered by a grocery owner. Fresh food nutrition
            values are estimates unless supported by verified nutrition data.
          </p>

          <HealthAssessment product={product} />
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          SmartPantry AI provides general food information, not medical advice.
          An estimated freshness date does not guarantee food safety.
        </p>
      </div>
    </main>
  );
}

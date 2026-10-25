import Link from "next/link";
import {
  Barcode,
  Boxes,
  ClipboardList,
  QrCode,
  ShieldCheck,
  Store,
} from "lucide-react";
import { requireRole } from "@/lib/auth/roles";
import LogoutButton from "@/components/logout-button";
import FreshProductForm from "@/app/dashboard/fresh-product-form";
import ProductLookup from "@/app/dashboard/product-lookup";
import QRProductList from "./qr-product-list";

export const dynamic = "force-dynamic";
export default async function RetailerDashboard() {
  const { supabase, user, profile } = await requireRole(["retailer"]);
  const [productsRes, inventoryRes, donationsRes] = await Promise.all([
    supabase
      .from("pantry_products")
      .select(
        "id,name,category,price,unit,active,created_at,expiry_date,expiry_type",
      )
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inventory_batches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("donation_offers")
      .select("id,status", { count: "exact" })
      .eq("user_id", user.id),
  ]);
  const products = productsRes.data || [];
  const verified = Boolean(profile.is_verified);
  return (
    <main className="min-h-screen">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-extrabold">
            SmartPantry <span className="text-leaf">AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Retailer workspace · {profile.full_name || user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm font-bold text-leaf">GROCERY OWNER DASHBOARD</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          Your store product hub.
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Register fresh products, create customer QR codes, and look up
          packaged products by manufacturer barcode.
        </p>
        {!verified && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <ShieldCheck className="shrink-0" />
            <div>
              <h2 className="font-bold">Account awaiting verification</h2>
              <p className="mt-1 text-sm leading-6">
                Your retailer account must be verified by a SmartPantry
                administrator before you can register or modify store products.
                Your current product records remain viewable.
              </p>
            </div>
          </div>
        )}
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            title="Registered products"
            value={products.length}
            icon={QrCode}
          />
          <Metric
            title="Inventory batches"
            value={inventoryRes.count || 0}
            icon={Boxes}
          />
          <Metric
            title="Donation offers"
            value={donationsRes.count || 0}
            icon={ClipboardList}
          />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-mint p-3 text-leaf">
                <Store />
              </span>
              <div>
                <h2 className="text-xl font-extrabold">
                  Register fresh product
                </h2>
                <p className="text-sm text-slate-500">
                  Vegetables, fruits, loose grains and unlabelled products.
                </p>
              </div>
            </div>
            {verified ? (
              <FreshProductForm />
            ) : (
              <Disabled text="Product registration unlocks after admin verification." />
            )}
          </section>
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-mint p-3 text-leaf">
                <Barcode />
              </span>
              <div>
                <h2 className="text-xl font-extrabold">
                  Packaged product lookup
                </h2>
                <p className="text-sm text-slate-500">
                  Search Open Food Facts by existing barcode.
                </p>
              </div>
            </div>
            <ProductLookup />
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Check the returned data against the package. Missing nutrition
              data should not be invented.
            </p>
          </section>
        </div>
        <section className="mt-6 rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="rounded-xl bg-mint p-3 text-leaf">
              <QrCode />
            </span>
            <div>
              <h2 className="text-xl font-extrabold">
                Your QR product catalogue
              </h2>
              <p className="text-sm text-slate-500">
                Each QR opens the public product page. Print it for shelf labels
                or product displays.
              </p>
            </div>
          </div>
          <QRProductList products={products} />
        </section>
        <p className="mt-8 text-xs text-slate-500">
          Fresh-product nutrition may be estimated and is not a substitute for
          verified laboratory or label data.
        </p>
      </div>
    </main>
  );
}
function Metric({ title, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-5">
      <div className="flex items-center justify-between text-slate-500">
        <span className="text-sm">{title}</span>
        <Icon size={20} className="text-leaf" />
      </div>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
    </div>
  );
}
function Disabled({ text }) {
  return (
    <p className="rounded-xl bg-cream p-4 text-sm text-slate-600">{text}</p>
  );
}

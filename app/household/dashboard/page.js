import Link from "next/link";
import {
  Boxes,
  ChefHat,
  Clock3,
  HeartPulse,
  ListChecks,
  ScanLine,
  ShoppingBasket,
} from "lucide-react";
import { requireRole } from "@/lib/auth/roles";
import LogoutButton from "@/components/logout-button";
import InventoryForm from "@/app/dashboard/inventory-form";
import ProductLookup from "@/app/dashboard/product-lookup";
import { daysUntil, formatDate } from "@/lib/utils";
import MealPlanner from "../meal-planner";
import DonationAlertPopup from "./components/DonationAlertPopup";
import InventoryList from "./components/InventoryList";

export const dynamic = "force-dynamic";
const Card = ({ title, icon: Icon, children }) => (
  <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
    <div className="mb-4 flex items-center gap-3">
      <span className="rounded-xl bg-mint p-3 text-leaf">
        <Icon size={21} />
      </span>
      <h2 className="text-lg font-extrabold">{title}</h2>
    </div>
    {children}
  </section>
);

//solve

export default async function HouseholdDashboard() {
  const { supabase, user, profile } = await requireRole(["household"]);
  const [batchesRes, eventsRes, creditsRes] = await Promise.all([
    supabase
      .from("inventory_batches")
      .select(
        "id,product_name,quantity,unit,expiry_date,unit_cost,created_at,donation_status",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inventory_events")
      .select("id,event_type,quantity,unit,created_at,reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("user_credits")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const batches = batchesRes.data || [];
  const expiring = batches.filter(
    (b) =>
      Number(b.quantity) > 0 &&
      daysUntil(b.expiry_date) !== null &&
      daysUntil(b.expiry_date) >= 0 &&
      daysUntil(b.expiry_date) <= 3,
  ).length;
  const name = profile.full_name || user.email?.split("@")[0] || "there";
  return (
    <main className="min-h-screen">
      <DonationAlertPopup inventory={batches} />
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-extrabold">
            SmartPantry <span className="text-leaf">AI</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href={"/chatbot"} className="text-blue-500">
              Chatbot
            </Link>
            <span className="hidden text-sm text-slate-500 sm:inline">
              Household workspace · {name}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm font-bold text-leaf">HOUSEHOLD DASHBOARD</p>
        <h1 className="mt-1 text-3xl font-extrabold">
          Your pantry, made smarter.
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Track groceries, understand food products, and use expiry reminders to
          help reduce household food waste.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            title="Inventory batches"
            value={batches.length}
            icon={Boxes}
          />
          <Metric title="Use soon" value={expiring} icon={Clock3} />
          <Metric
            title="Credits"
            value={creditsRes.data?.credits ?? 0}
            icon={HeartPulse}
          />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            <Card title="Scan a packaged product" icon={ScanLine}>
              <ProductLookup onFound={undefined} />
              <p className="mt-2 text-xs text-slate-500">
                Enter a manufacturer barcode to look up product information.
                Product data availability varies.
              </p>
            </Card>
            <Card title="Add groceries to your pantry" icon={ShoppingBasket}>
              <InventoryForm onDone={undefined} />
            </Card>
          </div>
          <div className="space-y-6">
            <Card title="Your inventory" icon={Boxes}>
              {batches.length > 0 ? (
                <InventoryList initialBatches={batches} />
              ) : (
                <Empty
                  title="No inventory yet"
                  description="Add grocery items to start tracking your food."
                />
              )}
            </Card>

            <Card title="Recent activity" icon={ListChecks}>
              {(eventsRes.data || []).length ? (
                <div className="space-y-3">
                  {eventsRes.data.map((e) => (
                    <div
                      key={e.id}
                      className="flex justify-between gap-3 rounded-xl bg-cream p-3"
                    >
                      <div>
                        <p className="font-semibold capitalize">
                          {e.event_type.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(e.created_at)}
                        </p>
                      </div>
                      <span className="text-sm font-bold">
                        {e.quantity} {e.unit}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="Your consumption and waste records will appear here." />
              )}
            </Card>
          </div>
          <div className="mt-6">
            <Card title="Cook with your pantry" icon={ChefHat}>
              <MealPlanner inventory={batches} />
            </Card>
          </div>
        </div>
        <p className="mt-8 text-xs leading-5 text-slate-500">
          Health information is general guidance, not a diagnosis. Check product
          labels and seek professional advice for medical dietary needs.
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
        <Icon className="text-leaf" size={20} />
      </div>
      <p className="mt-3 text-3xl font-extrabold">{value}</p>
    </div>
  );
}
function Empty({ text }) {
  return (
    <p className="rounded-xl bg-cream p-4 text-sm text-slate-600">{text}</p>
  );
}

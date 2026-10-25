import Link from "next/link";
import {
  HeartHandshake,
  PackageCheck,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";

import { requireRole } from "@/lib/auth/roles";
import LogoutButton from "@/components/logout-button";

import { formatDate } from "@/lib/utils";
import { approveDonationRequest } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrganizationDashboard() {
  const { supabase, user, profile } = await requireRole(["organization"]);

  const verified = Boolean(profile?.is_verified);

  // Load available donation offers and this organization's requests.
  const [offersResult, requestsResult] = await Promise.all([
    supabase
      .from("donation_offers")
      .select(
        "id, product_name, quantity, unit, notes, status, created_at, user_id",
      )
      .eq("status", "offered")
      .order("created_at", { ascending: false })
      .limit(100),

    supabase
      .from("donation_requests")
      .select("id, offer_id, status, notes, created_at")
      .eq("organization_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (offersResult.error) {
    console.error("Failed to fetch donation offers:", offersResult.error);
  }

  if (requestsResult.error) {
    console.error("Failed to fetch donation requests:", requestsResult.error);
  }

  // Declare each variable only once.
  const offers = offersResult.data ?? [];
  const requests = requestsResult.data ?? [];

  // Fetch offer details for request history using the actual offer_id column.
  const requestedOfferIds = [
    ...new Set(requests.map((request) => request.offer_id).filter(Boolean)),
  ];

  let requestedOffers = [];
  let requestedOffersError = null;

  if (requestedOfferIds.length > 0) {
    const result = await supabase
      .from("donation_offers")
      .select("id, product_name, quantity, unit")
      .in("id", requestedOfferIds);

    requestedOffers = result.data ?? [];
    requestedOffersError = result.error;

    if (result.error) {
      console.error("Failed to fetch requested offer details:", result.error);
    }
  }

  const requestedOfferMap = new Map(
    requestedOffers.map((offer) => [offer.id, offer]),
  );

  // An organization can request an offer only once while its request
  // remains active. Cancelled requests do not block a new request.
  const existingRequestIds = new Set(
    requests
      .filter((request) => request.status !== "cancelled")
      .map((request) => request.offer_id),
  );

  return (
    <main className="min-h-screen bg-cream/30">
      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="font-extrabold">
            SmartPantry <span className="text-leaf">AI</span>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Donation partner · {profile?.full_name || user.email}
            </span>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <p className="text-sm font-bold text-leaf">
          DONATION ORGANIZATION DASHBOARD
        </p>

        <h1 className="mt-1 text-3xl font-extrabold">
          Help good food reach people.
        </h1>

        <p className="mt-2 max-w-2xl text-slate-600">
          Browse available surplus-food offers, request suitable donations, and
          track collection status.
        </p>

        {!verified && (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <ShieldCheck className="shrink-0" />

            <div>
              <h2 className="font-bold">Organization verification pending</h2>
              <p className="mt-1 text-sm leading-6">
                An administrator must verify your organization before you can
                request donations.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Metric
            title="Available offers"
            value={offersResult.error ? "—" : offers.length}
            icon={PackageCheck}
          />

          <Metric
            title="My requests"
            value={requestsResult.error ? "—" : requests.length}
            icon={ClipboardList}
          />

          <Metric
            title="Verified partner"
            value={verified ? "Yes" : "Pending"}
            icon={ShieldCheck}
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          {/* Available donation offers */}
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-mint p-3 text-leaf">
                <HeartHandshake />
              </span>

              <div>
                <h2 className="text-xl font-extrabold">
                  Available surplus food
                </h2>
                <p className="text-sm text-slate-500">
                  Offers are subject to confirmation and safe handling.
                </p>
              </div>
            </div>

            {offersResult.error ? (
              <Empty text="Unable to load donation offers. Check the server logs, donation_offers columns, and Supabase RLS policies." />
            ) : offers.length === 0 ? (
              <Empty text="No active donation offers are available right now. A user must successfully create a donation offer before it appears here." />
            ) : (
              <div className="space-y-3">
                {offers.map((offer) => {
                  const alreadyRequested = existingRequestIds.has(offer.id);

                  return (
                    <article
                      key={offer.id}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-bold">{offer.product_name}</h3>

                          <p className="mt-1 text-sm text-slate-500">
                            {offer.quantity} {offer.unit}
                            {" · Offered "}
                            {formatDate(offer.created_at)}
                          </p>

                          {offer.notes && (
                            <p className="mt-2 text-sm text-slate-600">
                              {offer.notes}
                            </p>
                          )}
                        </div>

                        <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-800">
                          Available
                        </span>
                      </div>

                      {!verified ? (
                        <p className="mt-3 text-xs text-amber-800">
                          Organization verification is required.
                        </p>
                      ) : (
                        alreadyRequested && (
                          <p className="mt-3 text-sm font-semibold text-emerald-700">
                            You have already requested this donation.
                          </p>
                        )
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Request history */}
          <section className="rounded-3xl border border-black/5 bg-white p-5 shadow-soft sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <span className="rounded-xl bg-mint p-3 text-leaf">
                <ClipboardList />
              </span>

              <div>
                <h2 className="text-xl font-extrabold">My donation requests</h2>
                <p className="text-sm text-slate-500">
                  Track your requests and follow up on collection.
                </p>
              </div>
            </div>

            {requestsResult.error ? (
              <Empty text="Unable to load request history. Check the donation_requests columns and Supabase RLS policies." />
            ) : requestedOffersError ? (
              <Empty text="Request history loaded, but donation details could not be retrieved. Check donation_offers permissions." />
            ) : requests.length === 0 ? (
              <Empty text="You haven't requested a donation yet." />
            ) : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const offer = requestedOfferMap.get(request.offer_id);

                  return (
                    <article
                      key={request.id}
                      className="rounded-xl border border-slate-100 p-4"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold">
                          {offer?.product_name || "Donation request"}
                        </h3>

                        <span className="rounded-full bg-cream px-2 py-1 text-xs font-bold capitalize">
                          {request.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        {offer ? `${offer.quantity} ${offer.unit} · ` : ""}
                        {formatDate(request.created_at)}
                      </p>

                      {request.notes && (
                        <p className="mt-2 text-sm text-slate-600">
                          {request.notes}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <p className="mt-8 text-xs leading-5 text-slate-500">
          Only request food you can collect, store, and distribute safely.
          Acceptance and collection must be confirmed by the donor.
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

function Empty({ text }) {
  return (
    <p className="rounded-xl bg-cream p-4 text-sm text-slate-600">{text}</p>
  );
}

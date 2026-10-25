"use client";

import { useEffect, useMemo, useState } from "react";

export default function DonationAlertPopup({ inventory = [] }) {
  const [isOpen, setIsOpen] = useState(true);
  const [offeredIds, setOfferedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setOfferedIds((previous) =>
      previous.filter((id) => inventory.some((item) => item.id === id)),
    );
  }, [inventory]);

  const donationItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const limit = new Date(today);
    limit.setDate(today.getDate() + 3);

    return inventory.filter((item) => {
      if (
        !item.expiry_date ||
        Number(item.quantity) <= 0 ||
        item.donation_status === "available" ||
        item.donation_status === "collected" ||
        offeredIds.includes(item.id)
      ) {
        return false;
      }

      const expiry = new Date(item.expiry_date);
      if (Number.isNaN(expiry.getTime())) return false;

      expiry.setHours(0, 0, 0, 0);
      return expiry >= today && expiry <= limit;
    });
  }, [inventory, offeredIds]);

  async function handleDonate(item) {
    setBusyId(item.id);
    setErrorMessage("");
    setMessage("");

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryId: item.id }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not offer this item.");
      }

      setOfferedIds((previous) => [...previous, item.id]);
      setMessage(`🎉 ${result.message} (+${result.credits_awarded} credits)`);
    } catch (error) {
      setErrorMessage(error.message || "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  if (!isOpen || (donationItems.length === 0 && !message && !errorMessage)) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-alert-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-2xl">
            🎁
          </div>
          <div>
            <h2
              id="donation-alert-title"
              className="text-xl font-bold text-gray-900"
            >
              Food Donation Alert!
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Offer eligible food to an organization before it expires.
            </p>
          </div>
        </div>

        {donationItems.length > 0 && (
          <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
            {donationItems.map((item) => {
              const today = new Date();
              today.setHours(0, 0, 0, 0);

              const expiry = new Date(item.expiry_date);
              expiry.setHours(0, 0, 0, 0);

              const daysLeft = Math.round(
                (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
              );

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.product_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} {item.unit || ""}
                      </p>
                    </div>
                    <span className="text-right text-xs font-medium text-orange-700">
                      {daysLeft === 0
                        ? "Expires today"
                        : `${daysLeft} day(s) left`}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => handleDonate(item)}
                      className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busyId === item.id ? "Saving..." : "Donate"}
                    </button>

                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => setIsOpen(false)}
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    >
                      Keep It
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {message && (
          <p
            role="status"
            className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800"
          >
            {message}
          </p>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700"
          >
            {errorMessage}
          </p>
        )}

        <p className="mb-4 text-xs leading-5 text-gray-500">
          Only offer food that is safe, properly stored, and accepted by the
          receiving organization. Offering an item does not mean it has been
          collected.
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100"
        >
          Close
        </button>
      </div>
    </div>
  );
}

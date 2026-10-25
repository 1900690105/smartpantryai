"use client";

import { useEffect, useMemo, useState } from "react";

const initialLocation = {
  address: "",
  area: "",
  city: "",
  pincode: "",
  latitude: null,
  longitude: null,
};

export default function DonationAlertPopup({ inventory = [] }) {
  const [isOpen, setIsOpen] = useState(true);
  const [offeredIds, setOfferedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [locationMode, setLocationMode] = useState("manual");
  const [location, setLocation] = useState(initialLocation);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsMessage, setGpsMessage] = useState("");

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

  function updateLocation(field, value) {
    setLocation((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function useCurrentLocation() {
    setGpsMessage("");
    setErrorMessage("");

    if (!navigator.geolocation) {
      setGpsMessage("GPS location is not supported by this browser.");
      return;
    }

    setGpsLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation((previous) => ({
          ...previous,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));

        setLocationMode("gps");
        setGpsLoading(false);
        setGpsMessage(
          "Location captured. You can still enter the pickup address below.",
        );
      },
      (error) => {
        setGpsLoading(false);

        const reason =
          error.code === 1
            ? "Location permission was denied. Allow location access in your browser settings."
            : error.code === 2
              ? "Your location could not be determined. Try again or enter the address manually."
              : "Location request timed out. Try again or enter the address manually.";

        setGpsMessage(reason);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  }

  function selectManualLocation() {
    setLocationMode("manual");
    setGpsMessage("");
  }

  function validateLocation() {
    if (!location.address.trim()) {
      return "Enter the pickup address.";
    }

    if (!location.area.trim()) {
      return "Enter the area or locality.";
    }

    if (!location.city.trim()) {
      return "Enter the city.";
    }

    if (!/^\d{6}$/.test(location.pincode.trim())) {
      return "Enter a valid 6-digit Indian PIN code.";
    }

    if (
      locationMode === "gps" &&
      (location.latitude === null || location.longitude === null)
    ) {
      return "Capture your GPS location or select manual location.";
    }

    return "";
  }

  async function handleDonate(item) {
    setErrorMessage("");
    setMessage("");

    const validationError = validateLocation();

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setBusyId(item.id);

    try {
      const response = await fetch("/api/donations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inventoryId: item.id,
          pickupLocation: {
            address: location.address.trim(),
            area: location.area.trim(),
            city: location.city.trim(),
            pincode: location.pincode.trim(),
            latitude: location.latitude,
            longitude: location.longitude,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "Could not offer this item.");
      }

      setOfferedIds((previous) =>
        previous.includes(item.id) ? previous : [...previous, item.id],
      );

      setMessage(
        `🎉 ${result.message || "Donation offered successfully."}${
          result.credits_awarded != null
            ? ` (+${result.credits_awarded} credits)`
            : ""
        }`,
      );

      setLocation(initialLocation);
      setLocationMode("manual");
      setGpsMessage("");
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="donation-alert-title"
        className="my-auto w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
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
          <>
            <div className="mb-4 max-h-48 space-y-3 overflow-y-auto">
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
                    <div className="flex items-center justify-between gap-2">
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
                  </div>
                );
              })}
            </div>

            <div className="mb-4 rounded-xl border border-gray-200 p-4">
              <h3 className="font-bold text-gray-900">📍 Pickup location</h3>

              <p className="mt-1 text-sm text-gray-500">
                Tell the organization where it can collect the food.
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={selectManualLocation}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
                    locationMode === "manual"
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  Enter manually
                </button>

                <button
                  type="button"
                  onClick={useCurrentLocation}
                  disabled={gpsLoading || busyId !== null}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-60 ${
                    locationMode === "gps"
                      ? "border-green-600 bg-green-50 text-green-800"
                      : "border-gray-300 text-gray-700"
                  }`}
                >
                  {gpsLoading ? "Locating..." : "Use my GPS"}
                </button>
              </div>

              {gpsMessage && (
                <p role="status" className="mt-2 text-sm text-gray-600">
                  {gpsMessage}
                </p>
              )}

              {location.latitude !== null && location.longitude !== null && (
                <p className="mt-2 break-all text-xs text-green-700">
                  GPS: {location.latitude.toFixed(6)},{" "}
                  {location.longitude.toFixed(6)}
                </p>
              )}

              <div className="mt-4 space-y-3">
                <div>
                  <label
                    htmlFor="pickup-address"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Pickup address
                  </label>
                  <input
                    id="pickup-address"
                    value={location.address}
                    onChange={(e) => updateLocation("address", e.target.value)}
                    maxLength={250}
                    autoComplete="street-address"
                    placeholder="Building, street, landmark"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                  />
                </div>

                <div>
                  <label
                    htmlFor="pickup-area"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Area / locality
                  </label>
                  <input
                    id="pickup-area"
                    value={location.area}
                    onChange={(e) => updateLocation("area", e.target.value)}
                    maxLength={120}
                    autoComplete="address-level3"
                    placeholder="Area or locality"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="pickup-city"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      City
                    </label>
                    <input
                      id="pickup-city"
                      value={location.city}
                      onChange={(e) => updateLocation("city", e.target.value)}
                      maxLength={100}
                      autoComplete="address-level2"
                      placeholder="City"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="pickup-pincode"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      PIN code
                    </label>
                    <input
                      id="pickup-pincode"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={location.pincode}
                      onChange={(e) =>
                        updateLocation(
                          "pincode",
                          e.target.value.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      autoComplete="postal-code"
                      placeholder="6 digits"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-green-600"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-3 text-xs leading-5 text-gray-500">
                GPS requires browser permission and a secure connection (HTTPS,
                or localhost). GPS coordinates do not automatically provide a
                street address, so enter the address details too.
              </p>
            </div>

            <div className="mb-4 space-y-2">
              {donationItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busyId !== null}
                  onClick={() => handleDonate(item)}
                  className="w-full rounded-lg bg-green-600 px-3 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyId === item.id
                    ? `Offering ${item.product_name}...`
                    : `Donate ${item.product_name}`}
                </button>
              ))}
            </div>
          </>
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
          collected. Share only a pickup location you agree to disclose.
        </p>

        <button
          type="button"
          disabled={busyId !== null}
          onClick={() => setIsOpen(false)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-60"
        >
          Close
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getCurrentPosition, haversineDistanceMeters, formatDistanceMeters } from "@macro/shared/geo";

type Status = "checking" | "valid" | "invalid" | "error";

/**
 * Gates access to a site's dashboard behind a GPS geofence check — the
 * "Verify Location" step between "Select Site" and "Access Site" in the
 * login → clock-in flow. This is a UX-level gate only: the authoritative,
 * unbypassable check happens again server-side at Clock In/Clock Out
 * (see attendance/actions.ts) regardless of what happens here.
 */
export function SiteLocationGate({
  siteName,
  siteLat,
  siteLng,
  allowedRadius,
  children,
}: {
  siteName: string;
  siteLat: number;
  siteLng: number;
  allowedRadius: number;
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<Status>("checking");
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then(({ lat, lng }) => {
        if (cancelled) return;
        const distance = haversineDistanceMeters(lat, lng, siteLat, siteLng);
        setDistanceM(distance);
        setStatus(distance <= allowedRadius ? "valid" : "invalid");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(
          err instanceof GeolocationPositionError && err.code === err.PERMISSION_DENIED
            ? "Location access was denied. Enable location permissions for this site and retry."
            : "Couldn't get your location. Check your GPS/network connection and retry."
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  if (status === "checking") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-white p-6 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-primary" />
        <div className="text-sm font-semibold text-text-dark">Checking your location…</div>
      </div>
    );
  }

  if (status === "valid") {
    return (
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2 rounded-xl border border-olive/40 bg-olive/10 px-3.5 py-3 text-sm font-semibold text-olive-text">
          <span>🟢</span>
          <span>Location verified. You are {formatDistanceMeters(distanceM ?? 0)} from the site.</span>
        </div>
        {children}
      </div>
    );
  }

  // "invalid" or "error"
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-5 text-center">
      <div className="text-2xl">🔴</div>
      <div className="mt-2 text-sm font-bold text-red-700">
        {status === "invalid" ? "Outside authorised location" : "Location check failed"}
      </div>
      <p className="mt-1.5 text-xs text-red-700/90">
        {status === "invalid"
          ? `You are currently outside the authorised location for this site. You are ${formatDistanceMeters(distanceM ?? 0)} away — please move within ${allowedRadius}m of the site to continue.`
          : errorMessage}
      </p>
      <div className="mt-4 flex flex-col gap-1.5 rounded-lg bg-white/70 p-3 text-left text-xs text-text-muted">
        <div>
          <span className="font-semibold text-text-dark">Site:</span> {siteName}
        </div>
        {status === "invalid" && distanceM != null && (
          <div>
            <span className="font-semibold text-text-dark">Distance from site:</span> {formatDistanceMeters(distanceM)} (allowed: {allowedRadius}m)
          </div>
        )}
        <div>
          <span className="font-semibold text-text-dark">Status:</span> {status === "invalid" ? "Location Mismatch" : "Unavailable"}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          setStatus("checking");
          setErrorMessage(null);
          setAttempt((n) => n + 1);
        }}
        className="mt-4 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white"
      >
        Retry Location Check
      </button>
    </div>
  );
}

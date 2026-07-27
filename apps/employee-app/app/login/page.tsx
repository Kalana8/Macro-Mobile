"use client";

import Image from "next/image";
import { startTransition, useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { getCurrentPosition } from "@macro/shared/geo";
import { PrimaryButton, TextInput, FieldLabel } from "@/components/ui";
import { verifyCredentialsAction, confirmSiteLoginAction, type LoginState } from "./actions";

function SubmitButton({ locating, label }: { locating: boolean; label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending || locating}>
      {locating ? "Getting an accurate GPS fix…" : pending ? "Please wait…" : label}
    </PrimaryButton>
  );
}

export default function LoginPage() {
  const [credState, credAction] = useActionState<LoginState, FormData>(verifyCredentialsAction, {});
  const [siteState, siteAction] = useActionState<LoginState, FormData>(confirmSiteLoginAction, {});
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Capture synchronously — currentTarget goes null on this event after
    // an `await`, so it must be read before the geolocation request below.
    const form = e.currentTarget;
    setGeoError(null);
    setLocating(true);

    let position: { lat: number; lng: number } | null = null;
    try {
      position = await getCurrentPosition();
    } catch {
      setGeoError("Couldn't get your location — it's required for field roles.");
    }
    setLocating(false);

    const formData = new FormData(form);
    if (position) {
      formData.set("lat", String(position.lat));
      formData.set("lng", String(position.lng));
    }
    startTransition(() => {
      credAction(formData);
    });
  }

  function handleSiteSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget); // radio inputs are named "siteId"
    if (credState.lat != null) formData.set("lat", String(credState.lat));
    if (credState.lng != null) formData.set("lng", String(credState.lng));
    startTransition(() => {
      siteAction(formData);
    });
  }

  // Phase 2 — more than one assigned site: pick which one you're at today.
  if (credState.sites && credState.sites.length > 0) {
    return (
      <div className="min-h-screen bg-page-bg">
        <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center bg-white px-6 py-14 sm:px-7">
          <h1 className="mb-1.5 text-center text-[22px] font-bold text-text-dark sm:text-[24px]">Where are you today?</h1>
          <p className="mb-7 text-center text-[13.5px] text-text-muted sm:text-[14px]">
            Pick the site you&apos;re working at — we&apos;ll confirm you&apos;re within 20m of it.
          </p>

          <form onSubmit={handleSiteSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-2">
              {credState.sites.map((site) => (
                <label
                  key={site.id}
                  className={`flex items-center gap-3 rounded-[11px] border px-4 py-3.5 ${
                    selectedSiteId === site.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="siteId"
                    value={site.id}
                    checked={selectedSiteId === site.id}
                    onChange={() => setSelectedSiteId(site.id)}
                    required
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <div>
                    <div className="text-[14.5px] font-semibold text-text-dark">{site.name}</div>
                    <div className="text-xs text-text-muted">{site.address}</div>
                  </div>
                </label>
              ))}
            </div>

            {siteState.error && (
              <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{siteState.error}</div>
            )}

            <SubmitButton locating={false} label="Confirm My Location" />

            {siteState.error && (
              <a href="/login" className="mt-1 text-center text-[13px] font-semibold text-text-muted underline">
                Back to login
              </a>
            )}
          </form>
        </div>
      </div>
    );
  }

  // Phase 1 — email + password.
  return (
    <div className="min-h-screen bg-page-bg">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center bg-white px-6 py-14 sm:px-7">
        <div className="mb-9 flex justify-center">
          <Image src="/uploads/footer.webp" alt="MACRO Property Services" width={180} height={84} className="h-[84px] w-auto" priority />
        </div>
        <h1 className="mb-1.5 text-center text-[24px] font-bold text-text-dark sm:text-[26px]">Welcome back</h1>
        <p className="mb-8 text-center text-[14px] text-text-muted sm:text-[15px]">Sign in to continue to your workspace</p>

        <form onSubmit={handleCredentialsSubmit} className="flex flex-col gap-3.5">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" name="email" placeholder="you@company.com" required autoComplete="username" />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput type="password" name="password" placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <div className="mb-1.5 mt-0.5 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-text-dark">
              <input type="checkbox" className="h-4 w-4 accent-orange" />
              Remember me
            </label>
            <span className="text-[13px] font-semibold text-primary">Forgot Password?</span>
          </div>

          {(credState.error || geoError) && (
            <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
              {credState.error ?? geoError}
            </div>
          )}

          <SubmitButton locating={locating} label="Log In" />
          <p className="mt-0.5 text-center text-[11.5px] text-text-muted">
            Location is checked against your assigned sites at sign-in for field roles.
          </p>
        </form>

        <div className="mt-10 text-center text-xs text-placeholder">
          v0.1 · Field Audit &amp; Attendance
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import type { StoreRegistrationRequest } from "@/lib/types";

const emptyRegistration: StoreRegistrationRequest = {
  owner_display_name: "",
  owner_email: "",
  owner_password: "",
  legal_name: "",
  display_name: "",
  handle: "",
  jurisdiction: "",
  business_identifier: "",
  address: "",
  contact_email: "",
  contact_phone: "",
};

const emailPattern = /^\S+@\S+\.\S+$/;

export function StoreRegistrationForm() {
  const { t } = useLocale();
  const [registration, setRegistration] = useState<StoreRegistrationRequest>(emptyRegistration);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const auth = useAuth();
  const router = useRouter();

  function updateField(field: keyof StoreRegistrationRequest, value: string) {
    setRegistration((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = {
      ...registration,
      owner_display_name: registration.owner_display_name.trim(),
      owner_email: registration.owner_email.trim(),
      legal_name: registration.legal_name.trim(),
      display_name: registration.display_name.trim(),
      handle: registration.handle.trim().toLowerCase(),
      jurisdiction: registration.jurisdiction.trim(),
      business_identifier: registration.business_identifier.trim(),
      address: registration.address.trim(),
      contact_email: registration.contact_email.trim(),
      contact_phone: registration.contact_phone.trim(),
    };

    if (
      Object.values(normalized).some((value) => !value)
      || !emailPattern.test(normalized.owner_email)
      || !emailPattern.test(normalized.contact_email)
      || normalized.owner_password.length < 8
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized.handle)
    ) {
      setError(t("auth.validation.required"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await auth.registerStore(normalized);
      router.replace("/");
    } catch {
      setError(t("store.register.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("store.register.title")}
      description={t("store.register.description")}
      footerLabel={t("auth.register.footer")}
      footerHref="/login"
      footerAction={t("auth.register.signIn")}
    >
      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
          <fieldset className="space-y-4">
            <legend className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{t("store.register.owner")}</legend>
            <FormInput label={t("auth.register.name")} value={registration.owner_display_name} onChange={(value) => updateField("owner_display_name", value)} />
            <FormInput label={t("common.email")} type="email" value={registration.owner_email} onChange={(value) => updateField("owner_email", value)} />
            <FormInput label={t("auth.password")} type="password" minLength={8} value={registration.owner_password} onChange={(value) => updateField("owner_password", value)} />
          </fieldset>

          <fieldset className="space-y-4 border-t border-[var(--line)] pt-6">
            <legend className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">{t("store.register.business")}</legend>
            <FormInput label={t("store.register.legalName")} value={registration.legal_name} onChange={(value) => updateField("legal_name", value)} />
            <FormInput label={t("store.register.displayName")} value={registration.display_name} onChange={(value) => updateField("display_name", value)} />
            <FormInput label={t("store.register.handle")} value={registration.handle} onChange={(value) => updateField("handle", value)} />
            <FormInput label={t("store.register.jurisdiction")} value={registration.jurisdiction} onChange={(value) => updateField("jurisdiction", value)} />
            <FormInput label={t("store.register.identifier")} value={registration.business_identifier} onChange={(value) => updateField("business_identifier", value)} />
            <FormInput label={t("store.register.address")} value={registration.address} onChange={(value) => updateField("address", value)} />
            <FormInput label={t("store.register.contactEmail")} type="email" value={registration.contact_email} onChange={(value) => updateField("contact_email", value)} />
            <FormInput label={t("store.register.contactPhone")} type="tel" value={registration.contact_phone} onChange={(value) => updateField("contact_phone", value)} />
          </fieldset>

          {error ? (
            <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={submitting}
            type="submit"
          >
            {submitting ? t("store.register.submitting") : t("store.register.submit")}
            <ArrowRight size={16} />
          </button>
      </form>
    </AuthShell>
  );
}

function FormInput({
  label,
  type = "text",
  minLength,
  value,
  onChange,
}: {
  label: string;
  type?: string;
  minLength?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <input
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-4 py-3 outline-none transition focus:border-[var(--accent)]"
        minLength={minLength}
        onChange={(event) => onChange(event.target.value)}
        required
        type={type}
        value={value}
      />
    </label>
  );
}

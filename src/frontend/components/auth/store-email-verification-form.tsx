"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";

export function StoreEmailVerificationForm() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [verificationValue, setVerificationValue] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!verificationValue.trim()) {
      setError(true);
      return;
    }

    setSubmitting(true);
    setError(false);
    try {
      await auth.verifyStoreEmail(verificationValue.trim());
      setVerificationValue("");
      router.replace("/store/onboarding");
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" noValidate onSubmit={handleSubmit}>
      <label className="block space-y-3">
        <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
          {t("store.verify.value")}
        </span>
        <input
          autoComplete="one-time-code"
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 outline-none transition focus:border-[var(--accent)]"
          value={verificationValue}
          onChange={(event) => setVerificationValue(event.target.value)}
          required
        />
      </label>
      {error ? (
        <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger)]">
          {t("store.verify.error")}
        </div>
      ) : null}
      <button
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {submitting ? t("store.verify.submitting") : t("store.verify.submit")}
        <ArrowRight size={16} />
      </button>
    </form>
  );
}

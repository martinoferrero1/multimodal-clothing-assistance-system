"use client";

import { startTransition, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { useAuth } from "@/components/providers/auth-provider";
import { useLocale } from "@/components/providers/locale-provider";
import { ApiError } from "@/lib/api-client";

export function RegisterForm() {
  const auth = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | true | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace("/chat/new");
    }
  }, [auth.status, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName.trim() || !email.trim() || !password) {
      setError(t("auth.validation.required"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError(t("auth.validation.email"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.validation.passwordLength"));
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      await auth.signUp(displayName, email, password);
      startTransition(() => {
        router.replace("/chat/new");
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError && caughtError.hasExternalMessage
          ? caughtError.message
          : true,
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={t("auth.register.title")}
      description={t("auth.register.description")}
      footerLabel={t("auth.register.footer")}
      footerHref="/login"
      footerAction={t("auth.register.signIn")}
    >
      <form className="space-y-6" noValidate onSubmit={handleSubmit}>
        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            {t("auth.register.name")}
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 outline-none transition focus:border-[var(--accent)]"
            type="text"
            placeholder={t("auth.register.namePlaceholder")}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            {t("common.email")}
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 outline-none transition focus:border-[var(--accent)]"
            type="email"
            placeholder={t("auth.emailPlaceholder")}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            {t("auth.password")}
          </span>
          <div className="relative">
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 pr-14 outline-none transition focus:border-[var(--accent)]"
              type={showPassword ? "text" : "password"}
              placeholder={t("auth.register.passwordPlaceholder")}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error ? (
          <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger)]">
            {typeof error === "string" ? error : t("auth.register.error")}
          </div>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || auth.status === "loading"}
          type="submit"
        >
          {submitting ? t("auth.register.submitting") : t("auth.register.submit")}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthShell>
  );
}

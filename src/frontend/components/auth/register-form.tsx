"use client";

import { startTransition, useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";

import { AuthShell } from "@/components/auth/auth-shell";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/components/providers/auth-provider";

export function RegisterForm() {
  const auth = useAuth();
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace("/chat/new");
    }
  }, [auth.status, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await auth.signUp(displayName, email, password);
      startTransition(() => {
        router.replace("/chat/new");
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError ? caughtError.message : "We could not create your account.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create account"
      description="Register to start using our fashion assistant and receive personalized outfit recommendations."
      footerLabel="Already have an account?"
      footerHref="/login"
      footerAction="Sign in"
    >
      <form className="space-y-6" onSubmit={handleSubmit}>
        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Name
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 outline-none transition focus:border-[var(--accent)]"
            type="text"
            placeholder="Your user display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Email
          </span>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 outline-none transition focus:border-[var(--accent)]"
            type="email"
            placeholder="your-email@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        <label className="block space-y-3">
          <span className="text-xs uppercase tracking-[0.28em] text-[var(--muted)]">
            Password
          </span>
          <div className="relative">
            <input
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface)] px-5 py-4 pr-14 outline-none transition focus:border-[var(--accent)]"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] transition hover:text-[var(--text)]"
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error ? (
          <div className="rounded-lg border border-[var(--danger-line)] bg-[var(--danger-surface)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-4 text-sm font-semibold text-[var(--accent-ink)] transition hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting || auth.status === "loading"}
          type="submit"
        >
          {submitting ? "Creating account..." : "Join"}
          <ArrowRight size={16} />
        </button>
      </form>
    </AuthShell>
  );
}

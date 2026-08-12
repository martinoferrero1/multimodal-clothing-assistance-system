import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  footerLabel: string;
  footerHref: string;
  footerAction: string;
  children: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  footerLabel,
  footerHref,
  footerAction,
  children,
}: AuthShellProps) {
  return (
    <main className="relative flex min-h-screen overflow-hidden">
      <section className="relative hidden min-h-screen flex-1 overflow-hidden lg:flex">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center grayscale-[12%]" />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(14,14,14,0.82),rgba(14,14,14,0.3))]" />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-[var(--text)] xl:p-16">
          <div className="space-y-4">
            <h1 className="serif max-w-md text-6xl leading-none xl:text-7xl">
              Lookeate
            </h1>
            <p className="text-sm font-medium uppercase tracking-[0.32em] text-white/75">
              Your AI-Fashion Assistant
            </p>
          </div>
        </div>
      </section>

      <section className="relative flex w-full items-center justify-center px-6 py-10 lg:max-w-[44rem] lg:px-10">
        <div className="glass-strong soft-shadow hairline animate-rise-in w-full max-w-xl rounded-[2rem] p-7 sm:p-10">
          <div className="mb-10 space-y-8">
            <div className="space-y-2 lg:hidden">
              <h1 className="serif text-5xl leading-none text-[var(--text)] sm:text-6xl">
                Lookeate
              </h1>
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
                Your AI-Fashion Assistant
              </p>
            </div>
            <div className="space-y-3">
              <h2 className="serif text-4xl leading-none text-[var(--text)] sm:text-5xl">{title}</h2>
              <p className="max-w-lg text-sm leading-7 text-[var(--muted)] sm:text-base">{description}</p>
            </div>
          </div>

          {children}

          <div className="mt-8 border-t border-[var(--line)] pt-6 text-sm text-[var(--muted)]">
            {footerLabel}{" "}
            <Link className="font-semibold text-[var(--accent)] transition hover:opacity-80" href={footerHref}>
              {footerAction}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

# Backend instructions

## Scope and approved decisions

- These instructions apply to Python code under `src/`; a closer `AGENTS.md` may add more specific rules.
- When an OpenSpec change exists, use only the artifacts the user has reviewed as implementation scope. Do not create, edit, approve, archive, or mark OpenSpec artifacts complete unless the user explicitly asks.
- Use `documentation/identity_guest_environments_plan.md` as the architectural baseline for identity, guest, migration, and environment work. Surface deviations and tradeoffs before implementing them.

## Identity and configuration

- Derive the authenticated actor and resource ownership on the server. A request-provided user ID is never authorization evidence.
- Keep anonymous, guest, and member states distinct. Preserve ownership and user identity when promoting a guest.
- Never expose or log passwords, session tokens, cookie values, recovery tokens, CSRF secrets, or real environment values.
- Keep insecure defaults limited to explicit local/test environments. Staging and production configuration must fail closed.
- Do not add schema creation or alteration to normal application startup. Represent new schema changes with versioned migrations.
- Keep authentication and configuration tests independent from real LLM keys or external providers unless the behavior under test requires them.

## Backend quality

- Keep FastAPI routes thin, domain behavior in services, and persistence concerns in the database layer.
- Preserve async transaction boundaries and roll back failed multi-write identity operations.
- Return stable public errors without leaking account existence or internal exception details.
- Add positive and negative tests for changed behavior, including authorization failures and invalid configuration.
- Run focused tests first. Before handoff, run `PYTHONPATH=src python -m pytest tests/` when the change can affect the backend suite, and report any unrun check explicitly.

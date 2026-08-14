# Frontend instructions

## Scope and contracts

- Follow user-reviewed OpenSpec artifacts for frontend implementation scope; do not modify or approve those artifacts unless explicitly asked.
- Preserve Lookeate and Lookeate Assistant naming and the workspace behavior documented in the repository root instructions.
- Keep the frontend API client, auth provider, guards, and proxy contract synchronized with backend identity changes.

## Browser identity security

- Never store authentication credentials in `localStorage`, `sessionStorage`, browser-readable cookies, URLs, or client logs. Web Storage is only for non-sensitive interface preferences.
- Use same-origin requests and an `HttpOnly` server-issued session cookie. Forward `Cookie` to FastAPI and every `Set-Cookie` header back to the browser.
- Add the approved CSRF header to state-changing requests and preserve origin-related headers through the proxy.
- Model loading, anonymous, guest, and authenticated states explicitly. Do not use `guest` as a synonym for unauthenticated once guest identity work begins.
- Make logout call the backend and clear client state only after handling the server result. Do not simulate revocation by deleting local state alone.
- Never expose server secrets through `NEXT_PUBLIC_*` variables or client bundles.

## Frontend verification

- Test auth initialization, guest entry, promotion, expiry, logout, and unauthorized redirects as applicable.
- Run `npm run lint` and `npm run build` from `src/frontend/` before handoff for changes that affect frontend behavior, and report any unrun check explicitly.

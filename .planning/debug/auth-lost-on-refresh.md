# Debug: auth-lost-on-refresh

**Status:** Fixed
**File changed:** `apps/web/src/lib/auth-context.tsx`

---

## Root Cause

`callRefresh()` was parsing the tRPC response using the **tRPC v10 response shape**,
but the project uses **tRPC v11**, which changed the response envelope format.

### tRPC v10 response format
```json
{"result":{"data":{"json":<output>}}}
```

### tRPC v11 response format (no transformer)
```json
{"result":{"data":<output>}}
```

The old code parsed `data?.result?.data?.json`, which always resolved to `undefined`
in v11 because there is no `.json` wrapper. So `callRefresh()` always returned `null`.

On every page refresh:
1. `AuthProvider` mounts with `isLoading: true`
2. `DashboardGuard` shows spinner (correct — waiting for auth init)
3. `restoreSession()` calls `callRefresh()`
4. `callRefresh()` makes a valid POST to `/api/trpc/auth.refresh` (cookie is sent)
5. The API responds `200` with a valid tRPC v11 payload
6. The old parser reads `data.result.data.json` → `undefined`
7. `callRefresh()` returns `null`
8. `isLoading` → `false`, `user` → `null`
9. `DashboardGuard` redirects to `/login`

The refresh token cookie, cookie path, Next.js proxy, and API endpoint were all working correctly.
Only the client-side response parsing was wrong.

---

## Fix Applied

**`apps/web/src/lib/auth-context.tsx` — `callRefresh` function**

```diff
- const data = (await res.json()) as {
-   result?: { data?: { json?: { user: AuthUser; accessToken: string } } };
- };
- const payload = data?.result?.data?.json;
+ // tRPC v11 response format (no transformer): {"result":{"data":<output>}}
+ const data = (await res.json()) as {
+   result?: { data?: { user: AuthUser; accessToken: string } };
+ };
+ const payload = data?.result?.data;
```

Also removed the unnecessary `body: JSON.stringify({ json: {} })` from the fetch call.
tRPC v11 mutations with no input schema accept an absent body, which is what the
real tRPC client sends.

---

## Investigation Notes

- `DashboardGuard` correctly waits for `isLoading: false` before redirecting — no bug there
- `AuthProvider` correctly calls `restoreSession()` on mount — no bug there
- NestJS `auth.refresh` endpoint, cookie-parser, Drizzle session lookup — all correct
- Cookie path `/api/trpc/auth.refresh`, `sameSite: strict`, Next.js rewrite forwarding — all correct
- The only broken piece was the client-side JSON parsing of the tRPC v11 response envelope

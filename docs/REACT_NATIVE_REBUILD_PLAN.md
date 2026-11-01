# SkiManijaci → React Native Rebuild: Agent Execution Plan

This document is an instruction set for an AI coding agent. Execute phases in order. Do not start a phase until the previous phase's **Exit criteria** pass.

## 0. Ground rules

- **Source of truth for behavior is the Android Kotlin code** in `app/src/main/java/com/skimanijaci/app/`, not the docs. `docs/USER_GUIDE.md` (v1.0.10) is a user-facing overview only; other files in `docs/` are historical and often outdated.
- **Never copy secrets.** The Android app embeds `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` via `BuildConfig` and syncs password hashes to devices. Do not replicate this. The React Native app talks only to a backend API. No database credentials in the app bundle.
- Work in the existing Expo workspace selected by the user (`SkiManiacs`). Do not modify the sibling Android app.
- TypeScript strict mode. No `any` unless justified in a comment.
- Every phase ends with: lint + typecheck + tests green, and the checklist in section 9 updated.
- Ask the user before deciding anything listed in section 1 as **OPEN**.
- Keep commits small, one logical change each.

## 1. Decisions

| # | Decision | Status |
|---|----------|--------|
| D1 | Framework: Expo (managed, EAS Build), TypeScript | Decided |
| D2 | Navigation: Expo Router with file-based routes, drawer, and native stack | Decided |
| D3 | Server state: TanStack Query; client state: Zustand | Decided |
| D4 | Offline cache: `expo-sqlite` (offers, favorites); `expo-secure-store` for tokens | Decided |
| D5 | i18n: `i18next` + `react-i18next`, languages `sr` (default) and `en` | Decided |
| D6 | Backend: use the existing Turso database behind a new API | Decided |
| D7 | Admin: in-app, or separate web admin panel | **OPEN – ask user** (default: defer to Phase 4) |
| D8 | Existing-user passwords: preserve the existing PBKDF2 hash format and column while both apps run in parallel | Decided |

## 2. Scope by persona

- **Guest** (no login): browse offers; no price, availability, places or deadline; date sort only; filters by date, category, location; language switch; Contacts, Terms, Privacy. Detail screen shows the membership-required message with a call button.
- **Signed-in user (non-admin)**: everything above plus price, availability, available places, application deadline; price/available-only/favorites-only filters; price sort; favorites; My Account (edit profile, change password, delete account).
- **Admin**: offer CRUD, up to 5 images, bilingual form, CSV import, user management. **Out of scope until Phase 4**, but the data model, API and role checks must support it from Phase 0.

## 3. Domain model (mirror `model/Offer.kt`, `model/User.kt`, `model/Favorite.kt`)

```ts
type Offer = {
  id: string;
  title_sr: string; title_en: string | null;
  description_sr: string | null; description_en: string | null;
  category_sr: string | null; category_en: string | null;
  location_sr: string | null; location_en: string | null;
  price: string | null;            // legacy formatted string
  priceAmount: number | null;
  currency: 'EUR' | 'RSD' | null;
  isPriceComingSoon: boolean;
  startDate: string | null;        // YYYY-MM-DD
  endDate: string | null;
  imageUrl: string | null; imageUrl2: string | null; imageUrl3: string | null;
  imageUrl4: string | null; imageUrl5: string | null;   // max 5 images, first is cover
  availablePlaces: string | null;  // numeric string
  applicationDeadline: string | null; // YYYY-MM-DD
  updatedAt: number | null; updatedBy: string | null;
};
type User = { username: string; name?: string; surname?: string; email: string; isAdmin: boolean; isActive: boolean };
type Favorite = { userId: string; offerId: string };
```

## 4. Business rules to port exactly (with Android source reference)

| Rule | Source |
|------|--------|
| Available = `parseInt(availablePlaces) > 0`; blank/invalid → sold out. `isAvailable` field is derived, not authoritative. | `OfferListFragment.kt` (`isAvailableByPlaces`), `OfferDetailActivity.kt` |
| Past offer: start date earlier than today → badge "PAST" (gray) instead of available/sold out. | `OfferListFragment.kt` (`isPastOffer`, `getDateSortBucket`) |
| Date sort: upcoming offers first, then past, each by start date ascending. Guests always get date sort. | `OfferListFragment.kt` (`sortOffersByDate`) |
| Price sort: low→high uses `priceAmount ?? +∞`; high→low uses `priceAmount ?? 0`. Signed-in only. | `OfferListFragment.kt` (`getSortedOffers`) |
| Guests: hide price, availability, places, deadline; hide price filters, favorites-only, available-only; hide sort UI. | `OfferListFragment.kt`, `FilterBottomSheet.kt`, `OfferViewModel.kt` (`sanitizeFilter`) |
| Filters: date range on `startDate`; category/location multi-select using language-specific column; price range on `priceAmount`; available-only = places > 0; favorites-only. | `util/FilterQueryBuilder.kt` |
| Price display: `isPriceComingSoon` → localized "Coming Soon" / "Uskoro"; else EUR `€499`, RSD `499 RSD`; integers without decimals, else 2 decimals. | `model/Offer.kt` |
| Localization fallback: use selected language field, fall back to the other language if empty. | `util/LanguageManager.kt` |
| Password policy: ≥5 chars, ≥1 uppercase, ≥1 special character. Email valid. Username and email unique. | `util/UserValidation.kt`, `repo/UserRepository.kt` |
| My Account: current password required only when changing password; username change keeps session. Only for signed-in non-admin. | `ui/MyAccountActivity.kt` |
| Delete account: confirmation dialog, removes user and favorites, returns to guest. | `ui/MyAccountActivity.kt` |
| Favorites require login; toggle is local-first then synced; guests get a login prompt. | `ui/OfferViewModel.kt` |
| Inactive users cannot log in. | `ui/LoginActivity.kt` |
| Menu visibility: Favorites (signed-in), Login (guest), Logout (signed-in), My Account (signed-in non-admin), Upload CSV and User management (admin only). | `res/menu/drawer_menu.xml`, `ui/MainActivity.kt` |
| Strings (SR/EN) | `res/values/strings.xml`, `res/values-sr/strings.xml` |
| Terms and Privacy content | `res/raw/*.html`, `res/values/strings.xml` (`privacy_policy_url`) |

When a rule is unclear, read the referenced Kotlin file and write a unit test capturing the behavior before implementing it.

## 5. API contract (to be implemented by the backend; mock it in Phase 0)

All endpoints JSON over HTTPS. Auth via `Authorization: Bearer <accessToken>`. Roles enforced server-side.

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| POST | `/auth/login` | public | `{username,password}` → `{accessToken,refreshToken,user}`. 401 for bad credentials or inactive. |
| POST | `/auth/refresh` | public | refresh token → new access token |
| GET | `/offers` | public | Server **must strip** `price*`, `availablePlaces`, `applicationDeadline` for unauthenticated requests |
| GET | `/offers/:id` | public | same stripping |
| GET | `/me` | user | profile |
| PATCH | `/me` | user | name, surname, email, username, optional `currentPassword` + `newPassword`; 409 on duplicate username/email |
| DELETE | `/me` | user | deletes account and favorites |
| GET | `/me/favorites` | user | list of offer ids |
| PUT | `/me/favorites/:offerId` | user | idempotent add |
| DELETE | `/me/favorites/:offerId` | user | idempotent remove |
| POST/PUT/DELETE | `/offers`, `/offers/:id` | admin | Phase 4 |
| POST | `/uploads/sign` | admin | signed image upload, Phase 4 |
| POST | `/offers/import` | admin | CSV, Phase 4 |
| GET/POST/PATCH/DELETE | `/users`, `/users/:username` | admin | Phase 4 |

During parallel operation, the API must verify and write the existing PBKDF2-HMAC-SHA256 password format in `users.password` so password changes remain compatible with the Android app: 120,000 iterations, 16-byte salt, 256-bit derived key, and `Base64(salt):Base64(hash)` encoding. Verify actual stored formats without exposing credential values. Do not copy the Android app's plaintext-password fallback into the API without an explicit security decision. Keep hash verification server-side and never send hashes to clients. Consider a stronger hash migration only after the Android app is updated or retired, with an explicit compatibility plan.

## 6. Project structure

```
SkiManiacs/
  src/
    api/            # typed client, endpoints, mocks
    app/            # Expo Router routes and layouts
    domain/         # types, business rules (pure functions + unit tests)
    features/
      offers/       # list, detail, filters, sorting
      favorites/
      auth/
      account/
      static/       # contacts, terms, privacy
      admin/        # Phase 4 only
    i18n/           # sr.json, en.json
    state/          # Zustand client state
    storage/        # sqlite cache, secure token store
    theme/          # navy, accent blue/red/green, neutral gray (see res/values/colors.xml)
  __tests__/
```

Put all rules from section 4 in `domain/` as pure functions with tests. UI must not reimplement them.

## 7. Phases

### Phase 0: Foundations
Tasks:
1. Scaffold Expo + TypeScript, ESLint, Prettier, Jest, React Native Testing Library, CI workflow (lint, typecheck, test).
2. Create `domain/` types and pure functions: `isAvailable`, `isPastOffer`, `sortByDate`, `sortByPrice`, `formatPrice`, `localize`, `applyFilters`, `validatePassword`, `validateEmail`. Port test cases from section 4.
3. Typed API client with a **mock server** (MSW or local fixtures) matching section 5, seeded from `sample_offers.csv` / `OffersCSV.csv` in the Android repo.
4. i18n setup; port strings needed by Phases 1–2 from `values/strings.xml` and `values-sr/strings.xml`.
5. Theme from `res/values/colors.xml`; support light/dark like `values-night`.
6. Navigation shell: drawer with role-aware items, stack for detail.
Exit criteria: app boots to an empty offers screen; domain tests pass; CI green.

### Phase 1: Guest MVP
Tasks:
1. Offers list: card with image carousel (dots when >1 image, placeholder when none), localized title/location, category badge, dates. Pull-to-refresh, empty state, loading and error states, offline cache fallback with a "sync failed, showing previously loaded offers" message.
2. Offer detail: image pager, category, location, dates, description, membership-required card with call link to the phone in `strings.xml` (`pop_phone`).
3. Filter bottom sheet (date range, category, location chips derived from loaded offers in current language), active-filter chips, Clear and Clear All.
4. Language switch (SR/EN) persisted.
5. Contacts, Terms and Conditions, Privacy Policy screens (SR/EN). Pull content from `res/raw/` and `strings.xml`; verify social links with the user before hardcoding.
Exit criteria: all guest rules in section 4 covered by tests; manual run on iOS and Android simulators; guest never receives price data from the API (verify in network logs).

### Phase 2: Signed-in users
Tasks:
1. Login/logout screens; tokens in SecureStore; refresh flow; handle inactive user and server-unreachable errors (strings `invalid_credentials`, `login_server_unreachable`).
2. Show price (with Coming Soon), availability badge, places and deadline.
3. Price range, Available only, Favorites only filters; sort UI (date, price low→high, price high→low).
4. Favorites: optimistic toggle, local persistence, sync on startup/login, login prompt for guests, Favorites screen with empty state message.
5. My Account: edit profile, change password, delete account with confirmation, localized validation errors.
Exit criteria: all section 4 rules covered; account deletion verified end to end (Google Play and App Store requirement); token expiry handled.

### Phase 3: Release hardening
Tasks: accessibility labels and dynamic type; crash reporting (Sentry); analytics decision with user; error boundaries; app icon and splash from `ski.png` / launcher assets; EAS build profiles; privacy and data-safety declarations; store listings; smoke test on physical devices. Port checks from `docs/RELEASE_BUILD_GUIDE.md`.
Exit criteria: release candidate builds for both platforms; manual regression checklist (section 9) fully ticked.

### Phase 4: Admin (only after user approval of D7)
Tasks: offer create/edit/delete with SR/EN tabs and fields from `AdminEditActivity.kt`; image pick/upload (max 5, first is cover, change/delete with confirmation); price, currency, Coming Soon switch; available places and deadline; CSV import (see `util/CsvUploadHandler.kt` for column order and upsert semantics: never deletes missing offers; report new/updated/error counts); user management (see `ui/UserManagementActivity.kt`); admin menu items.
Exit criteria: admin flows tested against the real backend; non-admin tokens rejected by server on all admin endpoints.

## 8. Existing data and schema changes (coordinate with user before destructive work)

- The existing Turso database remains the source of truth behind the new API. Do not copy or migrate the offers, users, or favorites database as part of this rebuild.
- Inspect the schema in `app/src/main/assets/db-scripts/create_tables.sql` and the Turso data sources before implementing the API.
- Preserve the existing `users.password` column and hash format while both apps run. Do not export, log, or commit password values; verify stored formats without exposing credential values.
- Any required schema change must be additive where possible, tested against a copy, and accompanied by rollback instructions before production approval.
- Migrate images or rewrite URLs only if the user approves a storage change.

## 9. Parity and regression checklist (tick as completed)

Guest
- [ ] Offers list loads, refreshes, works offline from cache
- [ ] No price, availability, places or deadline anywhere (UI and API)
- [ ] Date sort: upcoming first, then past
- [ ] Filters: date, category, location (language-specific)
- [ ] Detail shows membership card and working call link
- [ ] SR/EN switch persists; missing translation falls back
- [ ] Contacts, Terms, Privacy render in both languages

Signed-in
- [ ] Login, logout, inactive user rejected
- [ ] Price formatting (EUR, RSD, Coming Soon)
- [ ] Available / Sold out / Past badges
- [ ] Price and available-only and favorites-only filters; price sorts
- [ ] Favorites add/remove/sync/offline
- [ ] My Account edit, password change rules, duplicate username/email errors
- [ ] Delete account removes data and returns to guest

Admin (Phase 4)
- [ ] Offer CRUD, 5-image management, CSV import, user management

## 10. Reporting

After each phase, output: what was done, tests added, deviations from this plan, open questions, and the updated checklist. Stop and ask the user whenever you hit an **OPEN** decision or find a conflict between this plan and the Kotlin code.

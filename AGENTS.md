# PackTabs Extension - Agent Guide & Codebase Rules

## 1. Project Overview
PackTabs is a Chrome & Firefox Manifest V3 tab-session manager built with the WXT Framework, Vue 3 Composition API, and Tailwind CSS. It lets users save an entire window of task-focused tabs in one click — replacing tedious one-by-one bookmarking and bookmark bar clutter — organize permanent collections alongside automatic history snapshots, and restore any workspace instantly.

## 2. Technology Stack & Frameworks
- **Extension Framework**: [WXT Framework](https://wxt.dev/) (v0.21.x) with Vite 8+ bundler
- **Frontend Stack**: Vue 3 (Composition API with `<script setup>`), Pinia state management
- **Design & UI**: Tailwind CSS v4, lightweight accessible primitives via [Radix Vue](https://www.radix-vue.com/), [Lucide Vue Next](https://lucide.dev/) icons (never introduce bulky suites like PrimeVue, Element Plus, or Vuetify)
- **Persistence Layer**:
  - `local:tabGroups`: Sharded tab groups stored in Local Storage (10MB capacity, avoiding Sync's 8KB per-item quota)
  - `sync:settings`: User preferences synced across profiles via Sync Storage
- **Testing**: Vitest, `@vue/test-utils`, `fast-check` (property-based testing)
- **Package Manager**: Bun (`bun run dev`, `bun run build`, `bun run test`, `bun run check`)

## 3. Directory Structure
```text
packtabs-extension/
├── AGENTS.md                  # Repo overview, commands, and high-level rules
├── .agents/rules/             # Detailed MV3 / UI / release engineering rules
├── docs/                      # Project documentation
│   ├── architecture.md        # Technical architecture and design decisions
│   ├── RELEASING.md           # Release versioning, store credentials, and CI/CD guide
│   ├── USER_GUIDE.md          # End-user guides (EN & ZH)
│   └── specs/                 # Feature requirements, design specs, and tasks
├── entrypoints/               # WXT extension entry points
│   ├── background.ts          # MV3 Service Worker (session tracking, cold-start recovery, shortcuts)
│   └── dashboard/             # Full-page manager dashboard (Vue 3 application)
├── components/                # Reusable Vue components
│   ├── ui/                    # Headless Tailwind primitives (badge, button, card, dialog, input, toast, tooltip)
│   ├── CollectionDetail.vue   # Active group / current-tabs detail view
│   ├── TabGroupCard.vue       # Interactive tab group card
│   ├── TabGroupList.vue       # Responsive list/grid of groups
│   ├── TabItemRow.vue         # Tab row with overflow-only tooltip & sibling controls
│   ├── StartupRestorer.vue    # Cold-start recovery view
│   └── SettingsModal.vue      # Preferences modal (theme, language, close-after-save, history limit)
├── composables/               # Vue composables (useSettings, useTheme, useI18n, useToast)
├── stores/                    # Pinia stores (useTabStore.ts)
├── types/                     # TypeScript domain models (TabGroup.ts, Storage.ts)
├── utils/                     # Services (storage.ts, tabManager.ts, dashboardLauncher.ts, date.ts, keyboard.ts, init-app.ts)
├── scripts/                   # Release & store submission automation (release.ts, submit.ts)
├── tests/                     # Unit & fast-check property tests
└── public/                    # Extension icons & minimal Manifest `_locales` (4 `__MSG_*__` keys only)
```

## 4. Core Engineering Guardrails
> Detailed MV3, Firefox cold-start, date-sorting, copywriting, and Radix Vue pitfalls live in `.agents/rules/extension-rules.md` (always loaded alongside this file).

1. **MV3 & Unified `browser.*` APIs**: Keep all runtime logic in `entrypoints/background.ts` inside `defineBackground(() => { ... })`, always use WXT's `browser.*` (never global `chrome.*`), and access favicons strictly via `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`.
2. **Cross-Context Storage & Settings Concurrency**: Persist tab groups in `local:tabGroups`, clone immutably before writing, serialize writes across Service Worker and Dashboard using named `navigator.locks` mutexes in `utils/storage.ts` (`withLock`, `withSessionLock`, `withSettingsLock`), and route all `sync:settings` mutations through `updateSettings` in `composables/useSettings.ts` with `settingsStorage.watch`.
3. **Session Lifecycle & Snapshot Hygiene**: Call `clearWindowSessionTabs(windowId)` before closing a window after saving, cancel pending debounced session sync on window close, detect cold starts via `browser.storage.session` (fail closed if unavailable), keep history deletion tombstones TTL-bounded (5 min), and sort groups descending with `getTimeSafe`.
4. **UI/UX & Anti-Over-Design**: Put interaction hints in card footers/empty states and show tab-row hover tooltips only on overflow (`scrollWidth > clientWidth`) with Radix `disable-hoverable-content`; mount `<ToastContainer />` outside mode-conditional branches; keep row controls as sibling `<button>`s; keep `public/_locales/*/messages.json` to the 4 Manifest keys only; fix invariants at storage/composable seams instead of over-fragmenting views.
5. **Mandatory Quality Gate**: Before finishing any code modification, always run `bun run check` (or `bun run lint:fix`) and resolve all TypeScript, ESLint, and Vitest issues to 0 errors.
6. **Even/Odd Versioning & Automated CI Release**: Odd minors (`1.5.0`) are active dev; even minors (`1.4.0`, `1.6.0`) are store releases (strict numeric `X.Y.Z`). Because `.github/workflows/release.yml` automatically submits to CWS and Firefox AMO on `v*` tag pushes, write the curated bilingual `### 📦 Chrome Web Store & Firefox AMO Release Notes` block in `CHANGELOG.md` **before** running `bun run release`, and never run local `bun run submit` concurrently with a tag push. See `docs/RELEASING.md` for full release and CI/CD instructions.

## 5. Standard CLI Commands
```powershell
# Run full automated quality check (TypeCheck + ESLint + Vitest)
bun run check

# Development server with hot module reload
bun run dev

# Production build for Chrome MV3 / Firefox MV3
bun run build
bun run build:firefox

# Run full test suite (300+ tests)
bun run test

# TypeScript type check (no emit)
bun run compile

# Release promotion & store submission (see docs/RELEASING.md)
bun run release
bun run release:dry
bun run submit
bun run submit:dry
```

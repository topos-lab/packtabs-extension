# PackTabs Extension - Agent Guide & Codebase Rules

## 1. Project Overview
PackTabs is a high-performance, minimalist Chrome Manifest V3 browser extension built with the WXT Framework, Vue 3 Composition API, and Tailwind CSS. It enables users to capture, organize into permanent collections or automatic history snapshots, and restore browser tab sessions with a single click.

## 2. Technology Stack & Frameworks
- **Extension Framework**: [WXT Framework](https://wxt.dev/) (v0.21.x) with Vite 8+ bundler
- **Frontend Stack**: Vue 3 (Composition API with `<script setup>`), Pinia state management
- **Design & UI**: Tailwind CSS v4, custom accessible primitives via [Radix Vue](https://www.radix-vue.com/), [Lucide Vue Next](https://lucide.dev/) icons
- **Persistence Layer**:
  - `local:tabGroups`: Sharded tab groups stored in Chrome Local Storage (10MB capacity, eliminating Chrome Sync's 8KB per-item quota)
  - `sync:settings`: User preferences synced across browser profiles via Chrome Sync Storage
- **Testing**: Vitest, @vue/test-utils, fast-check (property-based testing)
- **Package Manager**: Bun (`bun run dev`, `bun run build`, `bun run test`)

## 3. Directory Structure
```
packtabs-extension/
├── AGENTS.md                  # Core rules and agent instructions
├── docs/                      # Standard project documentation
│   ├── architecture.md        # Technical architecture and design decisions
│   └── specs/                 # Requirements, design specifications, and tasks
│       └── tab-group-manager/
├── entrypoints/               # WXT extension entry points
│   ├── background.ts          # MV3 Service Worker (tab capture, snapshot preservation)
│   └── dashboard/             # Full-page manager dashboard (Vue 3 application)
├── components/                # Reusable Vue components
│   ├── ui/                    # Lightweight accessible UI components (Button, Card, Input, Modal, Badge)
│   ├── TabGroupCard.vue       # Interactive tab group card
│   └── TabGroupList.vue       # Responsive grid of groups
├── stores/                    # Pinia stores (useTabStore.ts)
├── types/                     # TypeScript domain models (TabGroup.ts, Storage.ts)
├── utils/                     # Utility services (storage.ts, tabManager.ts, init-app.ts)
├── composables/               # Vue composables (useToast.ts)
├── tests/                     # Unit & fast-check property tests
└── public/                    # Extension icons and static assets
```

## 4. Critical Engineering Rules & Constraints
1. **Manifest V3 Runtime Environment**:
   - In `entrypoints/background.ts`, all runtime execution must remain inside `defineBackground(() => { ... })`.
   - Never access extension APIs at the top level outside lifecycle functions.
2. **Unified Browser API & Extension Identity**:
   - Always use `browser.*` (unified promise-based API provided by WXT), avoid using the global callback `chrome.*` directly.
   - Firefox `gecko.id` (`packtabs@topos-lab.github.io`) is purely an internal unique namespace. Mozilla never verifies DNS records or domain ownership; never purchase domains solely for `gecko.id`.
3. **Favicon Access Protocol**:
   - Chrome MV3 forbids direct `chrome://favicon/` URLs in extensions.
   - Always use `chrome-extension://${browser.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`.
4. **Storage Architecture**:
   - Tab groups must be persisted under `local:tabGroups`.
   - All write operations must pass through the `withLock` mutex in `utils/storage.ts` to ensure atomic serialization.
   - Always clone data immutably (e.g. `structuredClone`) before writing to prevent unintended cache mutations.
5. **No Heavy Component Libraries**:
   - Do NOT introduce bulky UI suites like PrimeVue, Element Plus, or Vuetify.
   - Keep UI components headless, tree-shakeable, and styled with Tailwind utility classes.
6. **Shortcut & Dashboard Activation Protocol**:
   - Use dedicated command names in `manifest.commands` (e.g. `open_dashboard`) with default shortcuts (`Alt+Shift+K` / `Command+Shift+K`).
   - Background service worker must handle `browser.commands.onCommand` and implement idempotent tab focus (switch to existing dashboard tab rather than opening duplicates).
7. **Firefox Dev Profile Persistence & Cold Start Protocol**:
   - Configure `firefoxProfile: './.wxt/firefox-data'` and `keepProfileChanges: true` in `wxt.config.ts`, ensuring directory existence prior to launch.
   - In Firefox temporary add-ons (`web-ext`), `browser.runtime.onStartup` never fires. Always use `browser.storage.session` to detect cold browser launches.
   - Guard active tab sync with `isStartupComplete` to prevent blank initial tabs (`about:blank`, `about:newtab`, `about:home`) from wiping unpersisted previous session tabs.
8. **Safe Date Sorting & Test Rigor**:
   - Tab groups must be sorted descending by `createdAt` (`sortGroupsByDateDesc`) across storage, store, and view layers.
   - Always sanitize timestamps with `getTimeSafe` to guarantee zero `NaN` comparator comparisons.
   - Property tests must verify entities by unique ID, never relying on fragile array index assumptions across hash map persistence.
9. **Value-Driven Copywriting**:
   - Prioritize user productivity and task-based context switching in documentation, UI text, and README.
   - Highlight the core pain point: avoiding tedious one-by-one bookmarking and bookmark bar clutter.
10. **Automated Quality & Lint Enforcement Protocol**:
   - Every AI agent modifying code in this codebase MUST automatically execute `bun run check` (or `bun run lint:fix`) before completing turn/task.
   - All TypeScript compilation errors, ESLint rules, and Vitest assertions must be proactively resolved to guarantee 0 errors. Never deliver code with unresolved lint warnings or failures.
11. **Even/Odd Versioning & Extension Store Release Strategy**:
   - **Odd Minors for Active Development**: Odd minor versions (e.g. `1.1.0`, `1.3.0`) represent active work-in-progress development cycles. Never submit odd-minor packages to public extension stores.
   - **Even Minors for Stable Store Releases**: Even minor versions (e.g. `1.0.0`, `1.2.0`, `1.4.0`) designate milestone production releases verified for Chrome Web Store and Firefox AMO submission. Hotfix patches use `MAJOR.EVEN_MINOR.PATCH` (e.g. `1.2.1`).
   - **Store Numerical Format Rule**: Manifest V3 and AMO reject non-numeric version suffixes (e.g. `-dev`, `-beta`). Versions in `package.json` and `wxt.config.ts` must strictly use dot-separated integers (`X.Y.Z`).
12. **Continuous Changelog & Store Submission Tracking**:
   - Maintain `CHANGELOG.md` adhering to Keep a Changelog (`Added`, `Fixed`, `Changed`).
   - Any new feature or bugfix must be immediately recorded under the active development version header.
   - When graduating to an even release, provide curated bilingual (English & Simplified Chinese) release notes in `CHANGELOG.md` ready for store review forms.

## 5. Standard CLI Commands
```powershell
# Run full automated quality check (TypeCheck + ESLint + Vitest)
bun run check

# Development server with hot module reload
bun run dev

# Production build for Chrome MV3
bun run build

# Production build for Firefox MV3
bun run build:firefox

# Run full test suite (180+ tests)
bun run test

# TypeScript type check (no emit)
bun run compile

# Automated release promotion & next dev cycle advancement (Even/Odd flow)
bun run release

# Dry-run release simulation (no file or git modification)
bun run release:dry
```

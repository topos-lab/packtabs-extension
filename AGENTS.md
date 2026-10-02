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
2. **Unified Browser API**:
   - Always use `browser.*` (unified promise-based API provided by WXT), avoid using the global callback `chrome.*` directly.
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

## 5. Standard CLI Commands
```powershell
# Development server with hot module reload
bun run dev

# Production build for Chrome MV3
bun run build

# Production build for Firefox MV2/MV3
bun run build:firefox

# Run full test suite (180+ tests)
bun run test

# TypeScript type check (no emit)
bun run compile
```

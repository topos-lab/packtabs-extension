import type { DeletedHistorySignatureEntry, StoredTabGroup } from '../types/Storage';
import {
  activeSessionTabsStorage,
  deletedHistorySignaturesStorage,
  settingsStorage,
  tabGroupsStorage,
} from '../types/Storage';
import type { TabGroup, TabItem } from '../types/TabGroup';
import { getTimeSafe, sortGroupsByDateDesc } from './date';

/**
 * Custom error types for storage operations
 */
export class StorageQuotaExceededError extends Error {
  constructor(message = 'Storage quota exceeded') {
    super(message);
    this.name = 'StorageQuotaExceededError';
  }
}

export class StorageNotFoundError extends Error {
  constructor(message = 'Resource not found in storage') {
    super(message);
    this.name = 'StorageNotFoundError';
  }
}

/**
 * Creates a promise mutex to serialize async operations atomically.
 * When `lockName` is provided and Web Locks API (`navigator.locks`) is available,
 * coordinates mutually exclusive execution across browser contexts (service worker & extension tabs).
 */
export function createMutex(lockName?: string) {
  let lock: Promise<unknown> = Promise.resolve();

  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const webLocks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (lockName && webLocks && typeof webLocks.request === 'function') {
      return await webLocks.request(lockName, () => operation());
    }

    const result = lock.then(() => operation());
    lock = result.catch(() => {
      // Suppress errors to avoid breaking subsequent lock acquisitions
    });
    return await result;
  };
}

const withLock = createMutex('packtabs:tabGroups');
const withSignatureLock = createMutex('packtabs:deletedSignatures');
export const withSessionLock = createMutex('packtabs:activeSessionTabs');
export const withSettingsLock = createMutex('packtabs:settings');

/**
 * Retry configuration for storage operations
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 50, // ms
  maxDelay: 1000, // ms
  backoffMultiplier: 2,
};

/**
 * Executes a storage operation with exponential backoff retry logic
 */
async function withRetry<T>(operation: () => Promise<T>, retries: number = RETRY_CONFIG.maxRetries): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is quota exceeded
      if (lastError.message.includes('QUOTA_BYTES') || lastError.message.includes('quota')) {
        throw new StorageQuotaExceededError(lastError.message);
      }

      // Do not retry on logical errors
      if (lastError instanceof StorageNotFoundError || lastError.message.includes('not found')) {
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt === retries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.initialDelay * RETRY_CONFIG.backoffMultiplier ** attempt,
        RETRY_CONFIG.maxDelay
      );

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Storage operation failed');
}

/**
 * Normalizes tab collections to ensure a plain array of TabItem objects
 */
export function normalizeTabs(tabs: unknown): TabItem[] {
  let list: unknown[] = [];
  if (Array.isArray(tabs)) {
    list = tabs;
  } else if (tabs && typeof tabs === 'object') {
    list = Object.values(tabs);
  }

  return list.map((item) => {
    const t = (item && typeof item === 'object' ? item : {}) as Partial<TabItem>;
    return {
      id: String(t.id || crypto.randomUUID()),
      url: String(t.url || ''),
      title: String(t.title || 'Untitled'),
      faviconUrl: t.faviconUrl ? String(t.faviconUrl) : undefined,
    };
  });
}

/**
 * Serializes a TabGroup for storage (converts Date to ISO string, detaching any Proxy)
 */
export function serializeTabGroup(group: TabGroup): StoredTabGroup {
  return {
    id: group.id,
    name: group.name,
    createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : new Date(group.createdAt).toISOString(),
    tabs: normalizeTabs(group.tabs),
    isHistory: Boolean(group.isHistory),
  };
}

/**
 * Deserializes a stored tab group (converts ISO string to Date and guarantees tabs is an Array)
 */
export function deserializeTabGroup(stored: StoredTabGroup): TabGroup {
  return {
    id: stored.id,
    name: stored.name,
    createdAt: new Date(stored.createdAt),
    tabs: normalizeTabs(stored.tabs),
    isHistory: Boolean(stored.isHistory),
  };
}

/**
 * Resolves sync conflicts using timestamp-based resolution (most recent wins).
 * Validates Requirement 2.3 and Property 18.3.
 */
export function resolveSyncConflict(localGroup: TabGroup, remoteGroup: StoredTabGroup): StoredTabGroup {
  const localTimestamp = getTimeSafe(localGroup.createdAt);
  const remoteTimestamp = getTimeSafe(remoteGroup.createdAt);

  // Keep the most recent version (newer wins; on tie, localGroup wins)
  return localTimestamp >= remoteTimestamp ? serializeTabGroup(localGroup) : remoteGroup;
}

function upsertGroupInMap(allGroups: Record<string, StoredTabGroup>, group: TabGroup): void {
  const serialized = serializeTabGroup(group);
  const existing = allGroups[group.id];
  allGroups[group.id] = existing ? resolveSyncConflict(group, existing) : serialized;
}

/**
 * Saves a tab group to storage
 */
export async function saveTabGroup(group: TabGroup): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };
      upsertGroupInMap(allGroups, group);

      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Saves a history tab group atomically using latest-wins deduplication for identical tab list signatures.
 * Older duplicate history groups are removed; if an existing duplicate history group is strictly newer,
 * it is preserved and the stale incoming snapshot is skipped. Named groups (`isHistory: false`) are never
 * deleted, and replaced history groups are not recorded as user-deleted tombstones.
 */
export async function saveHistoryTabGroup(group: TabGroup): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };
      const targetSignature = getTabsSignature(group.tabs);
      const incomingTime = getTimeSafe(group.createdAt);
      let supersededByNewer = false;

      if (targetSignature) {
        for (const [existingId, existingStored] of Object.entries(allGroups)) {
          if (existingStored?.isHistory && existingId !== group.id) {
            const existingSignature = getTabsSignature(normalizeTabs(existingStored.tabs));
            if (existingSignature === targetSignature) {
              const existingTime = getTimeSafe(existingStored.createdAt);
              if (existingTime > incomingTime) {
                supersededByNewer = true;
              } else {
                delete allGroups[existingId];
              }
            }
          }
        }
      }

      if (!supersededByNewer) {
        upsertGroupInMap(allGroups, { ...group, isHistory: true });
      }

      // Enforce maxHistoryGroups retention limit if configured
      let maxHistoryGroups: number | undefined;
      try {
        const settings = await settingsStorage?.getValue?.();
        maxHistoryGroups = settings?.maxHistoryGroups;
      } catch {
        // Non-critical fallback if settings storage is unavailable in isolated tests
      }

      if (typeof maxHistoryGroups === 'number' && Number.isFinite(maxHistoryGroups) && maxHistoryGroups > 0) {
        const historyEntries = Object.entries(allGroups)
          .filter(([, entry]) => Boolean(entry?.isHistory))
          .sort(([, a], [, b]) => getTimeSafe(b.createdAt) - getTimeSafe(a.createdAt));

        for (const [overflowId] of historyEntries.slice(Math.floor(maxHistoryGroups))) {
          delete allGroups[overflowId];
        }
      }

      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Retrieves all tab groups from storage
 */
export async function getTabGroups(): Promise<TabGroup[]> {
  return await withRetry(async () => {
    const allGroups = (await tabGroupsStorage.getValue()) ?? {};

    const deserialized = Object.values(allGroups).map((stored) => deserializeTabGroup(stored));
    return sortGroupsByDateDesc(deserialized);
  });
}

/**
 * Updates a tab group with partial data
 */
export async function updateTabGroup(id: string, updates: Partial<TabGroup>): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };

      const existingStored = allGroups[id];
      if (!existingStored) {
        throw new StorageNotFoundError(`Tab group with id ${id} not found`);
      }

      // Deep clone to prevent mutating in-memory cache if setValue fails
      const existingGroup = deserializeTabGroup(existingStored);
      const updatedGroup: TabGroup = {
        ...structuredClone(existingGroup),
        ...updates,
        id: existingGroup.id, // Ensure id cannot be changed
      };

      allGroups[id] = serializeTabGroup(updatedGroup);
      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Normalizes a tab URL for deduplication and signature matching.
 */
export function normalizeTabUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return '';
  }
  try {
    const u = new URL(trimmed);
    return (u.origin + u.pathname.replace(/\/+$/, '') + u.search + u.hash).toLowerCase();
  } catch {
    return trimmed.toLowerCase().replace(/\/+$/, '');
  }
}

/**
 * Generates a normalized signature of a tab set based on sorted unique URLs.
 * Used for deduplication and tombstone matching.
 */
export function getTabsSignature(tabs?: TabItem[]): string {
  if (!tabs || tabs.length === 0) {
    return '';
  }
  return Array.from(
    new Set(
      tabs
        .map((t) => (t.url ? normalizeTabUrl(t.url) : ''))
        .filter(Boolean)
    )
  )
    .sort()
    .join('|');
}

export const DELETED_SIGNATURE_TTL_MS = 5 * 60 * 1000;

function normalizeSignatureEntries(
  rawList: (string | DeletedHistorySignatureEntry)[] | undefined | null,
  now: number
): DeletedHistorySignatureEntry[] {
  if (!Array.isArray(rawList)) {
    return [];
  }
  const entries: DeletedHistorySignatureEntry[] = [];
  for (const item of rawList) {
    if (item && typeof item === 'object' && typeof item.sig === 'string' && typeof item.deletedAt === 'number') {
      if (now - item.deletedAt <= DELETED_SIGNATURE_TTL_MS) {
        entries.push(item);
      }
    }
  }
  return entries;
}

/**
 * Records a deleted history group's signature with a TTL so transient window-close / recovery
 * events do not resurrect it, without permanently blocking future sessions with the same tabs.
 */
export async function recordDeletedHistorySignature(tabs?: TabItem[]): Promise<void> {
  const sig = getTabsSignature(tabs);
  if (!sig) {
    return;
  }
  await withSignatureLock(async () => {
    try {
      const now = Date.now();
      const rawList = await deletedHistorySignaturesStorage.getValue();
      const active = normalizeSignatureEntries(rawList, now).filter((entry) => entry.sig !== sig);
      const updated: DeletedHistorySignatureEntry[] = [{ sig, deletedAt: now }, ...active].slice(0, 100);
      await deletedHistorySignaturesStorage.setValue(updated);
    } catch {
      // Non-critical fallback
    }
  });
}

/**
 * Removes a deleted history group's signature from the tombstone store (e.g. when undoing a deletion).
 */
export async function clearDeletedHistorySignature(tabs?: TabItem[]): Promise<void> {
  const sig = getTabsSignature(tabs);
  if (!sig) {
    return;
  }
  await withSignatureLock(async () => {
    try {
      const now = Date.now();
      const rawList = await deletedHistorySignaturesStorage.getValue();
      const active = normalizeSignatureEntries(rawList, now);
      const filtered = active.filter((entry) => entry.sig !== sig);
      if (filtered.length !== active.length) {
        await deletedHistorySignaturesStorage.setValue(filtered);
      }
    } catch {
      // Non-critical fallback
    }
  });
}

/**
 * Checks if a tab set matches a recently deleted history group signature (within TTL).
 */
export async function isDeletedHistorySignature(tabs?: TabItem[]): Promise<boolean> {
  const sig = getTabsSignature(tabs);
  if (!sig) {
    return false;
  }
  try {
    const now = Date.now();
    const rawList = await deletedHistorySignaturesStorage.getValue();
    return normalizeSignatureEntries(rawList, now).some((entry) => entry.sig === sig);
  } catch {
    return false;
  }
}

/**
 * Removes tracked active session tabs for a specific browser window atomically.
 * Used before intentionally closing a window after saving so onRemoved does not create a duplicate history snapshot.
 */
export async function clearWindowSessionTabs(windowId: number): Promise<void> {
  await withSessionLock(async () => {
    try {
      const sessionMap = (await activeSessionTabsStorage.getValue()) ?? {};
      const key = String(windowId);
      if (key in sessionMap) {
        const updated = { ...sessionMap };
        delete updated[key];
        await activeSessionTabsStorage.setValue(updated);
      }
    } catch {
      // Non-critical session cleanup
    }
  });
}

/**
 * Removes any pending active session tab entries whose URL signature matches a deleted history group.
 */
export async function removeMatchingSessionTabs(signature: string): Promise<void> {
  if (!signature) {
    return;
  }
  await withSessionLock(async () => {
    try {
      const sessionMap = (await activeSessionTabsStorage.getValue()) ?? {};
      let modified = false;
      const updated = { ...sessionMap };
      for (const [winId, tabs] of Object.entries(sessionMap)) {
        if (getTabsSignature(tabs) === signature) {
          delete updated[winId];
          modified = true;
        }
      }
      if (modified) {
        await activeSessionTabsStorage.setValue(updated);
      }
    } catch {
      // Non-critical session cleanup
    }
  });
}

/**
 * Deletes a tab group from storage
 */
export async function deleteTabGroup(id: string): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();

      if (!(id in rawGroups)) {
        throw new StorageNotFoundError(`Tab group with id ${id} not found`);
      }

      const targetGroup = rawGroups[id];
      if (targetGroup?.isHistory && targetGroup.tabs) {
        await recordDeletedHistorySignature(targetGroup.tabs);
      }

      const { [id]: _removed, ...remainingGroups } = rawGroups;
      await tabGroupsStorage.setValue(remainingGroups);
    });
  });
}

/**
 * Deletes a specific tab from a tab group
 */
export async function deleteTabFromGroup(groupId: string, tabId: string): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };

      const existingGroup = allGroups[groupId];
      if (!existingGroup) {
        throw new StorageNotFoundError(`Tab group with id ${groupId} not found`);
      }

      const existingTabs = normalizeTabs(existingGroup.tabs);

      const tabIndex = existingTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) {
        throw new StorageNotFoundError(`Tab with id ${tabId} not found in group ${groupId}`);
      }

      // Remove the tab immutably
      const updatedTabs = existingTabs.filter((tab) => tab.id !== tabId);

      const group: StoredTabGroup = {
        ...existingGroup,
        tabs: updatedTabs,
      };
      allGroups[groupId] = group;

      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Moves a tab from a source group to a target group atomically
 */
export async function moveTabBetweenGroups(
  sourceGroupId: string,
  targetGroupId: string,
  tabId: string
): Promise<void> {
  if (sourceGroupId === targetGroupId) {return;}

  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };

      const sourceStored = allGroups[sourceGroupId];
      if (!sourceStored) {
        throw new StorageNotFoundError(`Source tab group with id ${sourceGroupId} not found`);
      }

      const targetStored = allGroups[targetGroupId];
      if (!targetStored) {
        throw new StorageNotFoundError(`Target tab group with id ${targetGroupId} not found`);
      }

      const sourceTabs = normalizeTabs(sourceStored.tabs);
      const targetTabs = normalizeTabs(targetStored.tabs);

      const tabIndex = sourceTabs.findIndex((tab) => tab.id === tabId);
      if (tabIndex === -1) {
        throw new StorageNotFoundError(`Tab with id ${tabId} not found in source group ${sourceGroupId}`);
      }

      const tabToMove = sourceTabs[tabIndex];
      const incomingUrl = normalizeTabUrl(tabToMove.url);
      const alreadyInTarget = Boolean(
        incomingUrl && targetTabs.some((t) => normalizeTabUrl(t.url) === incomingUrl)
      );

      allGroups[sourceGroupId] = {
        ...sourceStored,
        tabs: sourceTabs.filter((tab) => tab.id !== tabId),
      };

      allGroups[targetGroupId] = {
        ...targetStored,
        tabs: alreadyInTarget ? targetTabs : [...targetTabs, tabToMove],
      };

      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Appends a tab to an existing group in storage if its normalized URL is not already present.
 * @returns `true` if added, `false` if skipped as duplicate.
 */
export async function addTabToGroup(groupId: string, tab: TabItem): Promise<boolean> {
  return await withLock(async () => {
    return await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };

      const existingGroup = allGroups[groupId];
      if (!existingGroup) {
        throw new StorageNotFoundError(`Tab group with id ${groupId} not found`);
      }

      const existingTabs = normalizeTabs(existingGroup.tabs);
      const incomingUrl = normalizeTabUrl(tab.url);
      if (incomingUrl && existingTabs.some((t) => normalizeTabUrl(t.url) === incomingUrl)) {
        return false;
      }

      const cleanTab: TabItem = {
        id: String(tab.id || crypto.randomUUID()),
        url: String(tab.url || ''),
        title: String(tab.title || 'Untitled'),
        faviconUrl: tab.faviconUrl ? String(tab.faviconUrl) : undefined,
      };

      allGroups[groupId] = {
        ...existingGroup,
        tabs: [...existingTabs, cleanTab],
      };

      await tabGroupsStorage.setValue(allGroups);
      return true;
    });
  });
}

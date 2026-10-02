import type { StoredTabGroup } from '../types/Storage';
import { tabGroupsStorage } from '../types/Storage';
import type { TabGroup, TabItem } from '../types/TabGroup';
import { sortGroupsByDateDesc } from './date';

/**
 * Storage service interface for tab group operations
 */
export interface StorageService {
  saveTabGroup(group: TabGroup): Promise<void>;
  getTabGroups(): Promise<TabGroup[]>;
  updateTabGroup(id: string, updates: Partial<TabGroup>): Promise<void>;
  deleteTabGroup(id: string): Promise<void>;
  deleteTabFromGroup(groupId: string, tabId: string): Promise<void>;
  moveTabBetweenGroups(sourceGroupId: string, targetGroupId: string, tabId: string): Promise<void>;
  addTabToGroup(groupId: string, tab: TabItem): Promise<void>;
  clearAllTabGroups(): Promise<void>;
}

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
 * In-memory mutex to ensure atomic serialization of write operations and prevent race conditions
 */
let writeLock: Promise<unknown> = Promise.resolve();

async function withLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = writeLock.then(() => operation());
  writeLock = result.catch(() => {
    // Suppress errors to avoid breaking subsequent lock acquisitions
  });
  return await result;
}

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
    tabs: stored.tabs == null ? (null as unknown as TabItem[]) : normalizeTabs(stored.tabs),
    isHistory: Boolean(stored.isHistory),
  };
}

/**
 * Resolves sync conflicts using timestamp-based resolution (most recent wins).
 * Validates Requirement 2.3 and Property 18.3.
 */
export function resolveSyncConflict(localGroup: TabGroup, remoteGroup: StoredTabGroup): StoredTabGroup {
  const localTimestamp = localGroup.createdAt instanceof Date ? localGroup.createdAt.getTime() : new Date(localGroup.createdAt).getTime();
  const remoteTimestamp = new Date(remoteGroup.createdAt).getTime();

  // Keep the most recent version (newer wins; on tie, localGroup wins)
  return localTimestamp >= remoteTimestamp ? serializeTabGroup(localGroup) : remoteGroup;
}

/**
 * Saves a tab group to storage
 */
export async function saveTabGroup(group: TabGroup): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };
      const serialized = serializeTabGroup(group);

      const existing = allGroups[group.id];
      if (existing) {
        allGroups[group.id] = resolveSyncConflict(group, existing);
      } else {
        allGroups[group.id] = serialized;
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
    const allGroups = await tabGroupsStorage.getValue();

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
 * Deletes a tab group from storage
 */
export async function deleteTabGroup(id: string): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();

      if (!(id in rawGroups)) {
        throw new StorageNotFoundError(`Tab group with id ${id} not found`);
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

      allGroups[sourceGroupId] = {
        ...sourceStored,
        tabs: sourceTabs.filter((tab) => tab.id !== tabId),
      };

      allGroups[targetGroupId] = {
        ...targetStored,
        tabs: [...targetTabs, tabToMove],
      };

      await tabGroupsStorage.setValue(allGroups);
    });
  });
}

/**
 * Appends a tab to an existing group in storage
 */
export async function addTabToGroup(groupId: string, tab: TabItem): Promise<void> {
  await withLock(async () => {
    await withRetry(async () => {
      const rawGroups = await tabGroupsStorage.getValue();
      const allGroups: Record<string, StoredTabGroup> = { ...rawGroups };

      const existingGroup = allGroups[groupId];
      if (!existingGroup) {
        throw new StorageNotFoundError(`Tab group with id ${groupId} not found`);
      }

      const existingTabs = normalizeTabs(existingGroup.tabs);

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
    });
  });
}

/**
 * Clears all tab groups from storage
 */
export async function clearAllTabGroups(): Promise<void> {
  await tabGroupsStorage.setValue({});
}

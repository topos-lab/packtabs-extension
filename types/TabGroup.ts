/**
 * Represents an individual tab within a tab group.
 */
export interface TabItem {
  /** Internal unique identifier (UUID v4), not the browser tabId */
  id: string;
  /** Full URL of the tab */
  url: string;
  /** Webpage title */
  title: string;
  /** Cached favicon URL if available */
  faviconUrl?: string;
}

/**
 * Represents a saved tab group (either automatic History snapshot or user-created Named group).
 */
export interface TabGroup {
  /** Unique identifier for the group (UUID v4) */
  id: string;
  /** Custom group name. Null indicates an unnamed automatic History Tab Group */
  name: string | null;
  /** Creation timestamp */
  createdAt: Date;
  /** Array of tabs contained in this group */
  tabs: TabItem[];
  /** Flag indicating whether this is an automatic history snapshot */
  isHistory: boolean;
}

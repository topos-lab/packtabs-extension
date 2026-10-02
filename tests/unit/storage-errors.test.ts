import { beforeEach, describe, expect, it, vi } from 'vitest';

import { tabGroupsStorage } from '../../types/Storage';
import type { TabGroup } from '../../types/TabGroup';
import { getTabGroups, saveTabGroup, updateTabGroup } from '../../utils/storage';

describe('Storage Error Handling', () => {
  beforeEach(async () => {
    // Clear storage before each test
    await tabGroupsStorage.setValue({});
    vi.clearAllMocks();
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
      if (typeof cb === 'function') cb();
      return 0 as any;
    });
  });

  describe('Connection Failures', () => {
    it('should handle storage getValue failures gracefully', async () => {
      // Mock getValue to throw an error
      vi.spyOn(tabGroupsStorage, 'getValue').mockRejectedValue(new Error('Storage connection failed'));

      await expect(getTabGroups()).rejects.toThrow('Storage connection failed');
    });

    it('should handle storage setValue failures gracefully', async () => {
      const testGroup: TabGroup = {
        id: 'test-1',
        name: 'Test Group',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      // Mock setValue to throw an error
      vi.spyOn(tabGroupsStorage, 'setValue').mockRejectedValue(new Error('Storage write failed'));

      await expect(saveTabGroup(testGroup)).rejects.toThrow('Storage write failed');
    });

    it('should handle transient failures and succeed on retry', async () => {
      const testGroup: TabGroup = {
        id: 'test-1',
        name: 'Test Group',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      // Mock setValue to fail once, then succeed
      const setValueSpy = vi.spyOn(tabGroupsStorage, 'setValue');

      setValueSpy.mockRejectedValueOnce(new Error('Transient failure'));

      // The call should succeed because withRetry will retry it
      await expect(saveTabGroup(testGroup)).resolves.not.toThrow();

      // Ensure it was called twice (once failed, once succeeded)
      expect(setValueSpy).toHaveBeenCalledTimes(2);

      const groups = await getTabGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe('test-1');
    });
  });

  describe('Quota Exceeded Scenarios', () => {
    it('should handle quota exceeded error', async () => {
      const testGroup: TabGroup = {
        id: 'large-group',
        name: 'Large Group',
        createdAt: new Date(),
        tabs: Array.from({ length: 1000 }, (_, i) => ({
          id: `tab-${i}`,
          url: `https://example${i}.com`,
          title: `Example ${i}`,
          faviconUrl: `https://example${i}.com/favicon.ico`,
        })),
        isHistory: false,
      };

      // Mock setValue to throw quota exceeded error
      vi.spyOn(tabGroupsStorage, 'setValue').mockRejectedValueOnce(new Error('QUOTA_BYTES_PER_ITEM quota exceeded'));

      await expect(saveTabGroup(testGroup)).rejects.toThrow('QUOTA_BYTES_PER_ITEM quota exceeded');
    });

    it('should handle storage full scenario', async () => {
      const testGroup: TabGroup = {
        id: 'test-1',
        name: 'Test Group',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      // Mock setValue to throw storage full error
      vi.spyOn(tabGroupsStorage, 'setValue').mockRejectedValueOnce(new Error('Storage quota exceeded'));

      await expect(saveTabGroup(testGroup)).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('Data Corruption Recovery', () => {
    it('should handle corrupted date strings', async () => {
      // Manually insert corrupted data
      await tabGroupsStorage.setValue({
        'corrupt-1': {
          id: 'corrupt-1',
          name: 'Corrupted Group',
          createdAt: 'invalid-date-string',
          tabs: [],
          isHistory: false,
        } as any,
      });

      const groups = await getTabGroups();

      expect(groups).toHaveLength(1);
      // Invalid date string creates Invalid Date object
      expect(groups[0].createdAt.toString()).toBe('Invalid Date');
    });

    it('should handle missing required fields', async () => {
      // Manually insert data with missing fields
      await tabGroupsStorage.setValue({
        'incomplete-1': {
          id: 'incomplete-1',
          name: 'Incomplete Group',
          // Missing createdAt
          tabs: [],
          isHistory: false,
        } as any,
      });

      const groups = await getTabGroups();

      expect(groups).toHaveLength(1);
      // Should still deserialize, but createdAt will be Invalid Date
      expect(groups[0].id).toBe('incomplete-1');
    });

    it('should handle corrupted tabs array', async () => {
      // Manually insert data with corrupted tabs
      await tabGroupsStorage.setValue({
        'corrupt-tabs': {
          id: 'corrupt-tabs',
          name: 'Corrupted Tabs',
          createdAt: new Date().toISOString(),
          tabs: null as any, // Corrupted tabs array
          isHistory: false,
        },
      });

      // Storage returns the corrupted data as-is
      // In a real implementation, we might want validation
      const groups = await getTabGroups();

      expect(groups).toHaveLength(1);
      expect(groups[0].tabs).toBeNull();
    });

    it('should handle empty storage object', async () => {
      await tabGroupsStorage.setValue({});

      const groups = await getTabGroups();

      expect(groups).toEqual([]);
    });

    it('should handle null storage value', async () => {
      // Force null value (simulating corruption)
      await tabGroupsStorage.setValue(null as any);

      // WXT storage returns default value ({}) when null is stored
      const groups = await getTabGroups();

      expect(groups).toEqual([]);
    });

    it('should handle update failure but note data mutation issue', async () => {
      const originalGroup: TabGroup = {
        id: 'update-1',
        name: 'Original',
        createdAt: new Date(),
        tabs: [{ id: 'tab-1', url: 'https://example.com', title: 'Example' }],
        isHistory: false,
      };

      await saveTabGroup(originalGroup);

      // Mock setValue to fail during update
      const setValueSpy = vi.spyOn(tabGroupsStorage, 'setValue').mockRejectedValue(new Error('Update failed'));

      await expect(updateTabGroup('update-1', { name: 'Updated' })).rejects.toThrow('Update failed');

      // With deep cloning and structuredClone protection, the data in storage remains unchanged
      // when setValue fails during an update.
      const groups = await getTabGroups();

      expect(groups[0].name).toBe('Original'); // Data was protected from mutation
    });

    it('should handle concurrent modifications', async () => {
      const group1: TabGroup = {
        id: 'group-1',
        name: 'Group 1',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      const group2: TabGroup = {
        id: 'group-2',
        name: 'Group 2',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      // Save both groups concurrently
      await Promise.all([saveTabGroup(group1), saveTabGroup(group2)]);

      const groups = await getTabGroups();

      expect(groups).toHaveLength(2);

      // Both groups should be present
      const ids = groups.map((g) => g.id).sort();

      expect(ids).toEqual(['group-1', 'group-2']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very long group names', async () => {
      const longName = 'A'.repeat(10000);
      const testGroup: TabGroup = {
        id: 'long-name',
        name: longName,
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      await saveTabGroup(testGroup);

      const groups = await getTabGroups();

      expect(groups[0].name).toBe(longName);
    });

    it('should handle special characters in URLs', async () => {
      const testGroup: TabGroup = {
        id: 'special-chars',
        name: 'Special Characters',
        createdAt: new Date(),
        tabs: [
          {
            id: 'tab-1',
            url: 'https://example.com/path?query=value&foo=bar#fragment',
            title: 'Special <>&" Characters',
            faviconUrl: 'https://example.com/favicon.ico?v=1',
          },
        ],
        isHistory: false,
      };

      await saveTabGroup(testGroup);

      const groups = await getTabGroups();

      expect(groups[0].tabs[0].url).toBe('https://example.com/path?query=value&foo=bar#fragment');
      expect(groups[0].tabs[0].title).toBe('Special <>&" Characters');
    });

    it('should handle empty tabs array', async () => {
      const testGroup: TabGroup = {
        id: 'empty-tabs',
        name: 'Empty Tabs',
        createdAt: new Date(),
        tabs: [],
        isHistory: false,
      };

      await saveTabGroup(testGroup);

      const groups = await getTabGroups();

      expect(groups[0].tabs).toEqual([]);
    });
  });
});

import { describe, expect, it } from 'vitest';

import { computeNextDevVersion, computeStableReleaseVersion } from '../../scripts/release';

describe('Release Version Computation Helpers', () => {
  describe('computeStableReleaseVersion', () => {
    it('promotes odd minor dev version to even minor stable release', () => {
      expect(computeStableReleaseVersion('1.1.0')).toBe('1.2.0');
      expect(computeStableReleaseVersion('1.3.0')).toBe('1.4.0');
      expect(computeStableReleaseVersion('2.5.0')).toBe('2.6.0');
    });

    it('bumps patch version if already an even minor release (hotfix)', () => {
      expect(computeStableReleaseVersion('1.2.0')).toBe('1.2.1');
      expect(computeStableReleaseVersion('1.2.1')).toBe('1.2.2');
    });

    it('throws on invalid version format', () => {
      expect(() => computeStableReleaseVersion('invalid')).toThrow();
      expect(() => computeStableReleaseVersion('1.0')).toThrow();
    });
  });

  describe('computeNextDevVersion', () => {
    it('advances stable even minor to next odd minor dev version', () => {
      expect(computeNextDevVersion('1.0.0')).toBe('1.1.0');
      expect(computeNextDevVersion('1.2.0')).toBe('1.3.0');
      expect(computeNextDevVersion('1.4.0')).toBe('1.5.0');
    });

    it('advances from odd minor to next odd minor if applied consecutively', () => {
      expect(computeNextDevVersion('1.1.0')).toBe('1.3.0');
    });

    it('throws on invalid version format', () => {
      expect(() => computeNextDevVersion('invalid')).toThrow();
    });
  });
});

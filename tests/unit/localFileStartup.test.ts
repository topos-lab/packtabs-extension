import { describe, expect, it } from 'vitest';

import { isLocalFileStartup } from '../../utils/tabManager';

describe('isLocalFileStartup utility', () => {
  it('should return false for empty or undefined tabs', () => {
    expect(isLocalFileStartup([])).toBe(false);
    expect(isLocalFileStartup(undefined as any)).toBe(false);
  });

  it('should return true when the only tab is a local file (e.g. PDF)', () => {
    const tabs = [{ url: 'file:///C:/Users/username/Downloads/annual-report.pdf' }];
    expect(isLocalFileStartup(tabs)).toBe(true);
  });

  it('should return true when the only tab is a local HTML document', () => {
    const tabs = [{ url: 'file:///D:/projects/demo/index.html' }];
    expect(isLocalFileStartup(tabs)).toBe(true);
  });

  it('should return true when url is not yet ready but pendingUrl is a local file', () => {
    const tabs = [
      {
        url: '',
        pendingUrl: 'file:///C:/Users/username/Documents/test.pdf',
      },
    ];
    expect(isLocalFileStartup(tabs)).toBe(true);
  });

  it('should return true when multiple local files are opened simultaneously', () => {
    const tabs = [
      { url: 'file:///C:/path/doc1.pdf' },
      { url: 'file:///C:/path/doc2.html' },
    ];
    expect(isLocalFileStartup(tabs)).toBe(true);
  });

  it('should return false for normal web pages', () => {
    const tabs = [{ url: 'https://github.com/topos-lab/packtabs-extension' }];
    expect(isLocalFileStartup(tabs)).toBe(false);
  });

  it('should return false for new tab / blank pages', () => {
    expect(isLocalFileStartup([{ url: 'chrome://newtab/' }])).toBe(false);
    expect(isLocalFileStartup([{ url: 'about:blank' }])).toBe(false);
    expect(isLocalFileStartup([{ url: 'about:newtab' }])).toBe(false);
  });

  it('should return false if the window contains regular remote web pages alongside a local file (restored session)', () => {
    const tabs = [
      { url: 'file:///C:/Users/username/test.pdf' },
      { url: 'https://google.com' },
      { url: 'https://news.ycombinator.com' },
    ];
    expect(isLocalFileStartup(tabs)).toBe(false);
  });
});

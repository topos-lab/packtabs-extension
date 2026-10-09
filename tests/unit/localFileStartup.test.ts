import { describe, expect, it } from 'vitest';

import { isBlankStartupTab, isBlankUrl, isLocalFileStartup } from '../../utils/tabManager';

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

describe('isBlankUrl and isBlankStartupTab utilities', () => {
  it('should correctly identify internal blank URLs', () => {
    expect(isBlankUrl('')).toBe(true);
    expect(isBlankUrl(undefined)).toBe(true);
    expect(isBlankUrl('about:blank')).toBe(true);
    expect(isBlankUrl('about:newtab')).toBe(true);
    expect(isBlankUrl('about:home')).toBe(true);
    expect(isBlankUrl('chrome://newtab/')).toBe(true);
    expect(isBlankUrl('chrome://new-tab-page/')).toBe(true);
    expect(isBlankUrl('edge://newtab')).toBe(true);
  });

  it('should return false for external web pages and app links', () => {
    expect(isBlankUrl('https://wow.blizzard.cn/news/24304160/index.html?blzcmp=app')).toBe(false);
    expect(isBlankUrl('https://github.com')).toBe(false);
    expect(isBlankUrl('file:///C:/Users/test.pdf')).toBe(false);
  });

  it('should return true for a genuinely empty tab', () => {
    expect(isBlankStartupTab({ url: 'chrome://newtab/' })).toBe(true);
    expect(isBlankStartupTab({ url: 'about:blank' })).toBe(true);
    expect(isBlankStartupTab({ url: '' })).toBe(true);
  });

  it('should return false when tab is launched from an external app like Blizzard Battle.net', () => {
    const battleNetTab = {
      url: 'https://wow.blizzard.cn/news/24304160/index.html?blzcmp=app',
    };
    expect(isBlankStartupTab(battleNetTab)).toBe(false);
  });

  it('should return false during early startup when url is about:blank but pendingUrl is an external link (race condition protection)', () => {
    const loadingAppTab = {
      url: 'about:blank',
      pendingUrl: 'https://wow.blizzard.cn/news/24304160/index.html?blzcmp=app',
    };
    expect(isBlankStartupTab(loadingAppTab)).toBe(false);
  });

  it('should return false during early startup when url is about:blank but pendingUrl is a local document', () => {
    const loadingLocalFileTab = {
      url: 'about:blank',
      pendingUrl: 'file:///D:/docs/readme.html',
    };
    expect(isBlankStartupTab(loadingLocalFileTab)).toBe(false);
  });

  it('should return false for undefined tab', () => {
    expect(isBlankStartupTab(undefined)).toBe(false);
  });
});

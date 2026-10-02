/**
 * Date formatting utilities with singleton Intl.DateTimeFormat instances.
 * Avoids repeated instantiation overhead across list and card components.
 */

import { activeLocale } from '~/composables/useI18n';

let fullDateTimeFormatter: Intl.DateTimeFormat | null = null;
let shortDateTimeFormatter: Intl.DateTimeFormat | null = null;
let cachedLocale: string | null = null;

function getUserLocale(): string {
  try {
    if (activeLocale?.value === 'zh_CN') return 'zh-CN';
    if (activeLocale?.value === 'zh_TW') return 'zh-TW';
    if (activeLocale?.value === 'en') return 'en-US';
  } catch {
    // Ignore outside Vue reactivity or during unit tests
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language;
  }
  return 'en-US';
}

function getFullDateTimeFormatter(): Intl.DateTimeFormat {
  const currentLocale = getUserLocale();
  if (!fullDateTimeFormatter || cachedLocale !== currentLocale) {
    cachedLocale = currentLocale;
    fullDateTimeFormatter = new Intl.DateTimeFormat(currentLocale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return fullDateTimeFormatter;
}

function getShortDateTimeFormatter(): Intl.DateTimeFormat {
  const currentLocale = getUserLocale();
  if (!shortDateTimeFormatter || cachedLocale !== currentLocale) {
    cachedLocale = currentLocale;
    shortDateTimeFormatter = new Intl.DateTimeFormat(currentLocale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
  return shortDateTimeFormatter;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Formats a Date into a localized full date-time string (e.g. "Oct 2, 2026, 20:30").
 * Falls back to ISO-like YYYY-MM-DD HH:mm if formatting throws.
 */
export function formatFullDateTime(dateInput: Date | string | number): string {
  try {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return getFullDateTimeFormatter().format(d);
  } catch {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
}

/**
 * Formats a Date for default group names (e.g. "Tab Group · Oct 2, 20:30").
 */
export function formatDefaultGroupName(date: Date = new Date(), prefix = 'Tab Group'): string {
  try {
    const formatted = getShortDateTimeFormatter().format(date);
    return `${prefix} · ${formatted}`;
  } catch {
    return `${prefix} · ${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}

/**
 * Safely extracts timestamp in milliseconds, returning 0 for any invalid or missing date
 * so that sort comparators never produce NaN (which breaks V8 sort).
 */
export function getTimeSafe(dateInput: Date | string | number | undefined | null): number {
  if (!dateInput) return 0;
  if (dateInput instanceof Date) {
    const t = dateInput.getTime();
    return isNaN(t) ? 0 : t;
  }
  const t = new Date(dateInput).getTime();
  return isNaN(t) ? 0 : t;
}

/**
 * Returns a new array sorted by createdAt descending (newest first).
 */
export function sortGroupsByDateDesc<T extends { createdAt: Date | string | number }>(groups: T[]): T[] {
  return [...groups].sort((a, b) => getTimeSafe(b.createdAt) - getTimeSafe(a.createdAt));
}


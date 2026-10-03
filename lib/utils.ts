import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBrowserType(): 'chrome' | 'firefox' | 'edge' {
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) {
      return 'firefox';
    }
    if (ua.includes('edg/')) {
      return 'edge';
    }
  }
  return 'chrome';
}

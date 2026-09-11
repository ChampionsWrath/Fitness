import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect } from 'react';
import { db } from '../db/db';
import type { UserProfile } from '../types';

/** undefined = loading, null = no profile yet */
export function useProfile(): UserProfile | null | undefined {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, [], undefined);
}

export function useTheme(pref: UserProfile['theme'] | undefined) {
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || ((pref ?? 'system') === 'system' && mq.matches);
      root.setAttribute('data-theme', dark ? 'dark' : 'light');
      const meta = document.querySelector('meta[name="theme-color"]:not([media])') as HTMLMetaElement | null;
      if (meta) meta.content = dark ? '#0f1115' : '#f4f5f7';
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [pref]);
}

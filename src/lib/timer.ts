import { useEffect, useState } from 'react';

/** Re-renders on an interval while active; the value is wall-clock time so timers survive backgrounding. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    const vis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', vis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('focus', vis);
    };
  }, [active, ms]);
  return now;
}

let ctx: AudioContext | null = null;

/** Call from a user gesture so iOS lets us play sound later. */
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    // play a silent buffer to unlock
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
  }
}

export function beep(times = 2) {
  try {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i % 2 ? 1046 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + i * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + i * 0.22 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.22 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + i * 0.22);
      osc.stop(t0 + i * 0.22 + 0.2);
    }
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[] = [120, 60, 120]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

/** Keeps the screen awake while a guided timer runs (iOS 16.4+ in PWA mode). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request('screen');
      } catch {
        /* ignore */
      }
    };
    void request();
    const vis = () => {
      if (document.visibilityState === 'visible' && !cancelled) void request();
    };
    document.addEventListener('visibilitychange', vis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', vis);
      void lock?.release();
    };
  }, [active]);
}

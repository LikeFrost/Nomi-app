import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { readJSON, writeJSON } from '../utils/storage';
import { todayKey } from '../utils/dateKey';

const STORAGE_KEY = 'daily_counter';

type Stored = { date: string; count: number };

export function useDailyCounter() {
  const [count, setCount] = useState(0);
  const ready = useRef(false);

  const refresh = useCallback(async () => {
    const today = todayKey();
    const stored = await readJSON<Stored>(STORAGE_KEY, { date: today, count: 0 });
    if (stored.date !== today) {
      const next = { date: today, count: 0 };
      await writeJSON(STORAGE_KEY, next);
      setCount(0);
    } else {
      setCount(stored.count);
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const increment = useCallback(() => {
    setCount((prev) => {
      const next = prev + 1;
      writeJSON<Stored>(STORAGE_KEY, { date: todayKey(), count: next }).catch(() => {});
      return next;
    });
  }, []);

  return { count, increment };
}

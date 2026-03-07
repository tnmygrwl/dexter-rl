import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { BarResult, TabData } from '@/types/tab';

interface SessionState {
  tabData: TabData | null;
  barResults: BarResult[];
  currentBarIndex: number;
  totalBars: number;
  setTabData: (data: TabData | null) => void;
  addBarResult: (result: BarResult) => void;
  setCurrentBarIndex: (index: number) => void;
  advanceBar: () => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [tabData, setTabData] = useState<TabData | null>(null);
  const [barResults, setBarResults] = useState<BarResult[]>([]);
  const [currentBarIndex, setCurrentBarIndex] = useState(0);

  const totalBars = useMemo(() => {
    if (!tabData) return 0;
    return Math.max(0, ...tabData.notes.map((n) => n.bar));
  }, [tabData]);

  const addBarResult = useCallback((result: BarResult) => {
    setBarResults((prev) => {
      const existing = prev.findIndex((r) => r.barIndex === result.barIndex);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = result;
        return updated;
      }
      return [...prev, result];
    });
  }, []);

  const advanceBar = useCallback(() => {
    setCurrentBarIndex((prev) => Math.min(prev + 1, Math.max(totalBars - 1, 0)));
  }, [totalBars]);

  const resetSession = useCallback(() => {
    setTabData(null);
    setBarResults([]);
    setCurrentBarIndex(0);
  }, []);

  const value = useMemo<SessionState>(
    () => ({
      tabData,
      barResults,
      currentBarIndex,
      totalBars,
      setTabData,
      addBarResult,
      setCurrentBarIndex,
      advanceBar,
      resetSession,
    }),
    [tabData, barResults, currentBarIndex, totalBars, addBarResult, advanceBar, resetSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

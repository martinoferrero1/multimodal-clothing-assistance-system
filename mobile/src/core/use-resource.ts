import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from "react";
export function useResource<T>(loader: () => Promise<T>) {
  const [data, updateData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const current = ++version.current;
    setLoading(true);
    setError(false);
    try {
      const result = await loader();
      if (current === version.current) updateData(result);
    } catch {
      if (current === version.current) setError(true);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [loader]);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        updateData(null);
        void reload();
      }
    });
    return () => {
      active = false;
      // This is a request generation counter, not a DOM ref.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version.current++;
    };
  }, [reload]);
  const setData = useCallback((value: SetStateAction<T | null>) => {
    // A completed mutation supersedes any older read already in flight.
    version.current++;
    updateData(value);
    setLoading(false);
    setError(false);
  }, []);
  return { data, setData, loading, error, reload };
}

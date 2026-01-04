import { useCallback, useEffect, useState } from "react";

export function useResizeObserver<T extends HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const [rect, setRect] = useState({ width: 0, height: 0 });
  const ref = useCallback((element: T | null) => {
    setNode(element);
  }, []);

  useEffect(() => {
    if (!node) return;
    const element = node;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setRect({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [node]);

  return { ref, rect, node };
}

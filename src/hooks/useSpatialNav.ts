import { useEffect, useRef, useState } from 'react';
import { globalRemote, RemoteEvent } from '../services/RemoteController';

export interface SpatialItem {
  id: string;
  onSelect?: () => void;
  row?: number;
  col?: number;
}

export function useSpatialNav(
  items: SpatialItem[],
  initialFocusId?: string,
  isEnabled: boolean = true
) {
  const [focusedId, setFocusedId] = useState<string>(initialFocusId || (items[0]?.id ?? ''));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!isEnabled) return;

    // Check if focusedId still exists in items, else reset to first item
    if (items.length > 0 && !items.some(i => i.id === focusedId)) {
      setFocusedId(items[0].id);
    }
  }, [items, focusedId, isEnabled]);

  useEffect(() => {
    if (!isEnabled) return;

    const unsubscribe = globalRemote.subscribe((event: RemoteEvent) => {
      const currentList = itemsRef.current;
      if (currentList.length === 0) return;

      const currentIndex = currentList.findIndex(i => i.id === focusedId);
      let nextIndex = currentIndex !== -1 ? currentIndex : 0;

      switch (event.action) {
        case 'DOWN':
          nextIndex = Math.min(currentList.length - 1, currentIndex + 1);
          break;
        case 'UP':
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case 'RIGHT':
          nextIndex = Math.min(currentList.length - 1, currentIndex + 1);
          break;
        case 'LEFT':
          nextIndex = Math.max(0, currentIndex - 1);
          break;
        case 'ENTER':
          if (currentIndex !== -1 && currentList[currentIndex].onSelect) {
            currentList[currentIndex].onSelect!();
          }
          break;
      }

      if (nextIndex !== currentIndex && currentList[nextIndex]) {
        const nextId = currentList[nextIndex].id;
        setFocusedId(nextId);
        // Scroll element into view
        const el = document.getElementById(nextId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [focusedId, isEnabled]);

  const setManualFocus = (id: string) => {
    setFocusedId(id);
  };

  return {
    focusedId,
    setManualFocus,
  };
}

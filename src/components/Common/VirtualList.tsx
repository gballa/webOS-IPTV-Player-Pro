import React, { useRef, useState, useEffect } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  viewportHeight: number;
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
  focusedIndex?: number;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number) => void;
  getItemKey?: (item: T, index: number) => string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  viewportHeight,
  renderItem,
  focusedIndex = 0,
  overscan = 4,
  className = '',
  getItemKey,
  onScroll,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;

  // Auto-scroll container when focused index changes
  useEffect(() => {
    if (focusedIndex >= 0 && containerRef.current) {
      const targetTop = focusedIndex * itemHeight;
      const currentScroll = containerRef.current.scrollTop;
      const viewBottom = currentScroll + viewportHeight;

      if (targetTop < currentScroll) {
        containerRef.current.scrollTop = targetTop;
      } else if (targetTop + itemHeight > viewBottom) {
        containerRef.current.scrollTop = targetTop + itemHeight - viewportHeight;
      }
    }
  }, [focusedIndex, itemHeight, viewportHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const st = e.currentTarget.scrollTop;
    setScrollTop(st);
    if (onScroll) {
      onScroll(st);
    }
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length - 1, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan);

  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      visibleItems.push({
        item: items[i],
        index: i,
        offsetTop: i * itemHeight,
      });
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto relative ${className}`}
      style={{ height: viewportHeight, contain: 'strict' }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleItems.map(({ item, index, offsetTop }) => {
          const key = getItemKey ? getItemKey(item, index) : index;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                top: offsetTop,
                left: 0,
                right: 0,
                height: itemHeight,
              }}
            >
              {renderItem(item, index, index === focusedIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

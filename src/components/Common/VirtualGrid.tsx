import React, { useRef, useState, useEffect, useMemo } from 'react';

interface VirtualGridProps<T> {
  items: T[];
  columns?: number;
  rowHeight: number;
  viewportHeight: number;
  renderItem: (item: T, index: number, isFocused: boolean) => React.ReactNode;
  focusedIndex?: number;
  overscanRows?: number;
  className?: string;
  getItemKey?: (item: T, index: number) => string;
}

export function VirtualGrid<T>({
  items,
  columns = 5,
  rowHeight,
  viewportHeight,
  renderItem,
  focusedIndex = -1,
  overscanRows = 2,
  className = '',
  getItemKey,
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows * rowHeight;

  // Auto-scroll when focused item changes
  useEffect(() => {
    if (focusedIndex >= 0 && containerRef.current) {
      const rowIndex = Math.floor(focusedIndex / columns);
      const targetTop = rowIndex * rowHeight;
      const currentScroll = containerRef.current.scrollTop;
      const viewBottom = currentScroll + viewportHeight;

      if (targetTop < currentScroll) {
        containerRef.current.scrollTop = targetTop;
      } else if (targetTop + rowHeight > viewBottom) {
        containerRef.current.scrollTop = targetTop + rowHeight - viewportHeight;
      }
    }
  }, [focusedIndex, columns, rowHeight, viewportHeight]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscanRows);
  const endRow = Math.min(totalRows - 1, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscanRows);

  const visibleRows = useMemo(() => {
    const rows = [];
    for (let r = startRow; r <= endRow; r++) {
      const rowStartIndex = r * columns;
      const rowItems = [];
      for (let c = 0; c < columns; c++) {
        const itemIdx = rowStartIndex + c;
        if (itemIdx < items.length) {
          rowItems.push({
            item: items[itemIdx],
            index: itemIdx,
          });
        }
      }
      if (rowItems.length > 0) {
        rows.push({
          rowIndex: r,
          offsetTop: r * rowHeight,
          items: rowItems,
        });
      }
    }
    return rows;
  }, [startRow, endRow, columns, rowHeight, items]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className={`overflow-y-auto relative ${className}`}
      style={{ height: viewportHeight, contain: 'strict' }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleRows.map(({ rowIndex, offsetTop, items: rowItems }) => (
          <div
            key={rowIndex}
            style={{
              position: 'absolute',
              top: offsetTop,
              left: 0,
              right: 0,
              height: rowHeight,
            }}
            className="px-2"
          >
            <div
              className="grid gap-4 w-full h-full"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {rowItems.map(({ item, index }) => {
                const key = getItemKey ? getItemKey(item, index) : index;
                return (
                  <div key={key} className="h-full flex flex-col min-w-0">
                    {renderItem(item, index, index === focusedIndex)}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

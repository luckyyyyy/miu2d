/**
 * 虚拟滚动 Hook
 * 高性能渲染大量列表项
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";

interface VirtualScrollOptions {
  /** 总项目数 */
  itemCount: number;
  /** 每项高度（固定） */
  itemHeight: number;
  /** 容器高度 */
  containerHeight: number;
  /** 过度渲染数量（上下各多渲染几项，减少滚动白屏） */
  overscan?: number;
}

interface VirtualScrollResult {
  /** 可见项的起始索引 */
  startIndex: number;
  /** 可见项的结束索引 */
  endIndex: number;
  /** 虚拟列表总高度 */
  totalHeight: number;
  /** 可见区域的偏移量 */
  offsetY: number;
  /** 滚动处理函数 */
  onScroll: (event: React.UIEvent<HTMLElement>) => void;
  /** 滚动位置引用 */
  scrollTop: number;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number) => void;
  /** 容器 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useVirtualScroll({
  itemCount,
  itemHeight,
  containerHeight,
  overscan = 5,
}: VirtualScrollOptions): VirtualScrollResult {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算总高度
  const totalHeight = itemCount * itemHeight;

  // 计算可见范围
  const { startIndex, endIndex, offsetY } = useMemo(() => {
    // 计算可见的第一个项目索引
    const start = Math.floor(scrollTop / itemHeight);
    // 计算可见的最后一个项目索引
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(start + visibleCount, itemCount - 1);

    // 应用 overscan
    const overscanStart = Math.max(0, start - overscan);
    const overscanEnd = Math.min(itemCount - 1, end + overscan);

    return {
      startIndex: overscanStart,
      endIndex: overscanEnd,
      offsetY: overscanStart * itemHeight,
    };
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan]);

  // 滚动事件处理
  const onScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  // 滚动到指定索引
  const scrollToIndex = useCallback(
    (index: number) => {
      const container = containerRef.current;
      if (!container) return;

      const targetScrollTop = index * itemHeight;
      container.scrollTop = targetScrollTop;
    },
    [itemHeight]
  );

  return {
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    onScroll,
    scrollTop,
    scrollToIndex,
    containerRef,
  };
}

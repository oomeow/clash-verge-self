import { Box, type SxProps, type Theme } from "@mui/material";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  forwardRef,
  type ReactNode,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

type ScrollToIndexOptions = {
  align?: "auto" | "center" | "end" | "start";
  behavior?: ScrollBehavior;
};

const findGroupSectionIndex = (groupIndexes: number[], itemIndex: number) => {
  let low = 0;
  let high = groupIndexes.length - 1;
  let matchedIndex = -1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);

    if (groupIndexes[middle] <= itemIndex) {
      matchedIndex = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return matchedIndex;
};

export interface StickyVirtualListHandle {
  getScrollElement: () => HTMLDivElement | null;
  isItemScrolledPastStart: (index: number, tolerance?: number) => boolean;
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
}

export interface StickyVirtualListProps<TItem> {
  items: TItem[];
  isGroupItem: (item: TItem, index: number) => boolean;
  getItemKey: (item: TItem, index: number) => React.Key;
  // 组固定高度, 不可动态计算需精确
  fixedGroupItemHeight: number;
  // 非组项预估高度, 虚拟列表可动态计算
  estimateItemHeight: number;
  groupItemSize: number;
  renderGroupItem: (item: TItem, index: number) => ReactNode;
  renderItem: (item: TItem, index: number) => ReactNode;
  className?: string;
  overscan?: number;
  stickyHeaderSx?: SxProps<Theme>;
}

function StickyVirtualListInner<TItem>(
  props: StickyVirtualListProps<TItem>,
  ref: React.ForwardedRef<StickyVirtualListHandle>,
) {
  const {
    items,
    isGroupItem,
    getItemKey,
    fixedGroupItemHeight,
    estimateItemHeight,
    groupItemSize,
    renderGroupItem,
    renderItem,
    className,
    overscan = 8,
    stickyHeaderSx,
  } = props;
  const scrollParentRef = useRef<HTMLDivElement>(null);

  const groupIndexes = useMemo(
    () =>
      items.reduce<number[]>((indexes, item, index) => {
        if (isGroupItem(item, index)) indexes.push(index);
        return indexes;
      }, []),
    [isGroupItem, items],
  );
  const groupSections = useMemo(
    () =>
      groupIndexes.map((groupIndex, index) => ({
        groupIndex,
        nextGroupIndex: groupIndexes[index + 1] ?? items.length,
      })),
    [groupIndexes, items.length],
  );
  const stickyHeaderSxList = useMemo(
    () =>
      stickyHeaderSx
        ? Array.isArray(stickyHeaderSx)
          ? stickyHeaderSx
          : [stickyHeaderSx]
        : [],
    [stickyHeaderSx],
  );
  const estimatedOffsets = useMemo(() => {
    const offsets = new Array<number>(items.length + 1);
    offsets[0] = 0;

    for (let i = 0; i < items.length; i++) {
      if (isGroupItem(items[i], i)) {
        offsets[i + 1] = offsets[i] + fixedGroupItemHeight;
      } else {
        offsets[i + 1] = offsets[i] + estimateItemHeight;
      }
    }

    return offsets;
  }, [fixedGroupItemHeight, estimateItemHeight, items]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    estimateSize: (index) =>
      isGroupItem(items[index], index)
        ? fixedGroupItemHeight
        : estimateItemHeight,
    getItemKey: (index) => getItemKey(items[index], index),
    getScrollElement: () => scrollParentRef.current,
    overscan,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  const getVirtualOffset = useCallback(
    (index: number) =>
      rowVirtualizer.measurementsCache[index]?.start ?? estimatedOffsets[index],
    [estimatedOffsets, rowVirtualizer],
  );
  const visibleGroupSections = useMemo(() => {
    if (!virtualItems.length || !groupSections.length) return [];

    const firstVirtualIndex = virtualItems[0].index;
    const lastVirtualIndex = virtualItems[virtualItems.length - 1].index;
    const matchedFirstSectionIndex = findGroupSectionIndex(
      groupIndexes,
      firstVirtualIndex,
    );
    const lastSectionIndex = findGroupSectionIndex(
      groupIndexes,
      lastVirtualIndex,
    );

    if (lastSectionIndex < 0) return [];

    const firstSectionIndex =
      matchedFirstSectionIndex >= 0 ? matchedFirstSectionIndex : 0;

    return groupSections.slice(
      firstSectionIndex,
      Math.min(lastSectionIndex + 2, groupSections.length),
    );
  }, [groupIndexes, groupSections, virtualItems]);

  useImperativeHandle(
    ref,
    () => ({
      getScrollElement: () => scrollParentRef.current,
      isItemScrolledPastStart: (index, tolerance = 0) => {
        const scroller = scrollParentRef.current;
        if (!scroller) return false;

        return scroller.scrollTop > getVirtualOffset(index) + tolerance;
      },
      scrollToIndex: (index, options) => {
        rowVirtualizer.scrollToIndex(index, options);
      },
    }),
    [getVirtualOffset, rowVirtualizer],
  );

  return (
    <Box ref={scrollParentRef} className={className}>
      <Box
        sx={{
          height: rowVirtualizer.getTotalSize(),
          position: "relative",
          width: "100%",
        }}>
        <Box
          sx={{
            inset: 0,
            pointerEvents: "none",
            position: "absolute",
            zIndex: 10,
          }}>
          {visibleGroupSections.map(({ groupIndex, nextGroupIndex }) => {
            const group = items[groupIndex];
            const start = getVirtualOffset(groupIndex);
            const end =
              nextGroupIndex < items.length
                ? getVirtualOffset(nextGroupIndex)
                : rowVirtualizer.getTotalSize();

            return (
              <Box
                key={getItemKey(group, groupIndex)}
                sx={{
                  height: Math.max(end - start, groupItemSize),
                  left: 0,
                  position: "absolute",
                  top: start,
                  width: "100%",
                }}>
                <Box
                  data-index={groupIndex}
                  sx={[
                    {
                      pointerEvents: "auto",
                      position: "sticky",
                      top: 0,
                      zIndex: 1,
                    },
                    ...stickyHeaderSxList,
                  ]}>
                  {renderGroupItem(group, groupIndex)}
                </Box>
              </Box>
            );
          })}
        </Box>

        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          if (isGroupItem(item, virtualRow.index)) return null;

          return (
            <Box
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              sx={{
                left: 0,
                position: "absolute",
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: "100%",
                zIndex: 1,
              }}>
              {renderItem(item, virtualRow.index)}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export const StickyVirtualList = forwardRef(StickyVirtualListInner) as <TItem>(
  props: StickyVirtualListProps<TItem> & {
    ref?: React.Ref<StickyVirtualListHandle>;
  },
) => React.ReactElement;

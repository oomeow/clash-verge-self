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

export interface StickyVirtualListHandle {
  getScrollElement: () => HTMLDivElement | null;
  isItemScrolledPastStart: (index: number, tolerance?: number) => boolean;
  scrollToIndex: (index: number, options?: ScrollToIndexOptions) => void;
}

export interface StickyVirtualListProps<TItem> {
  items: TItem[];
  isGroupItem: (item: TItem, index: number) => boolean;
  getItemKey: (item: TItem, index: number) => React.Key;
  estimateItemSize: (item: TItem, index: number) => number;
  groupItemSize: number;
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
    estimateItemSize,
    groupItemSize,
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
      offsets[i + 1] = offsets[i] + estimateItemSize(items[i], i);
    }

    return offsets;
  }, [estimateItemSize, items]);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    estimateSize: (index) => estimateItemSize(items[index], index),
    getItemKey: (index) => getItemKey(items[index], index),
    getScrollElement: () => scrollParentRef.current,
    overscan,
  });

  const getVirtualOffset = useCallback(
    (index: number) =>
      rowVirtualizer.measurementsCache[index]?.start ?? estimatedOffsets[index],
    [estimatedOffsets, rowVirtualizer],
  );

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
          {groupSections.map(({ groupIndex, nextGroupIndex }) => {
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
                  {renderItem(group, groupIndex)}
                </Box>
              </Box>
            );
          })}
        </Box>

        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
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

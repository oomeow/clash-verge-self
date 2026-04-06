import { useProfiles } from "@/hooks/use-profiles";
import { useCallback, useMemo } from "react";
import { ProxySortType } from "./use-filter-sort";
import {
  useProxyHeadStateStore,
  type HeadState,
  DEFAULT_STATE,
} from "@/stores/proxyHeadStateStore";

export { type HeadState, DEFAULT_STATE };

export function useHeadStateNew() {
  const { profiles } = useProfiles();
  const current = profiles?.current || "";

  const setOpen = useProxyHeadStateStore((s) => s.setOpen);
  const setShowType = useProxyHeadStateStore((s) => s.setShowType);
  const setSortType = useProxyHeadStateStore((s) => s.setSortType);
  const setFilterText = useProxyHeadStateStore((s) => s.setFilterText);
  const setTextState = useProxyHeadStateStore((s) => s.setTextState);
  const setTestUrl = useProxyHeadStateStore((s) => s.setTestUrl);
  const headStates = useProxyHeadStateStore((s) => s.headStates);

  // Get all states for current profile from store
  const state = useMemo(() => {
    if (!current || !headStates[current]) {
      return {};
    }
    return headStates[current] || {};
  }, [current, headStates]);

  const setHeadState = useCallback(
    (groupName: string, obj: Partial<HeadState>) => {
      // Update store using individual setters
      Object.entries(obj).forEach(([key, value]) => {
        switch (key as keyof HeadState) {
          case "open":
            setOpen(current, groupName, value as boolean | undefined);
            break;
          case "showType":
            setShowType(current, groupName, value as boolean);
            break;
          case "sortType":
            setSortType(current, groupName, value as ProxySortType);
            break;
          case "filterText":
            setFilterText(current, groupName, value as string);
            break;
          case "textState":
            setTextState(current, groupName, value as "url" | "filter" | null);
            break;
          case "testUrl":
            setTestUrl(current, groupName, value as string);
            break;
        }
      });
    },
    [
      current,
      setOpen,
      setShowType,
      setSortType,
      setFilterText,
      setTextState,
      setTestUrl,
    ],
  );

  return [state, setHeadState] as const;
}

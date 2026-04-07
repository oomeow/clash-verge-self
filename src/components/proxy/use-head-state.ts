import { useProfiles } from "@/hooks/use-profiles";
import { useMemo } from "react";
import {
  createScopedHeadStateActions,
  useProxyHeadStateStore,
  type HeadState,
  DEFAULT_STATE,
} from "@/stores/proxyHeadStateStore";

export { type HeadState, DEFAULT_STATE };

const EMPTY_HEAD_STATES: Record<string, HeadState> = {};

export function useScopedHeadStateActions(groupName: string) {
  const { profiles } = useProfiles();
  const current = profiles?.current || "";

  return useMemo(
    () => createScopedHeadStateActions({ current, groupName }),
    [current, groupName],
  );
}

export function useHeadStateNew() {
  const { profiles } = useProfiles();
  const current = profiles?.current || "";

  return useProxyHeadStateStore((state) =>
    current
      ? (state.headStates[current] ?? EMPTY_HEAD_STATES)
      : EMPTY_HEAD_STATES,
  );
}

export function useHeadState(groupName: string) {
  const headStates = useHeadStateNew();

  return useMemo(
    () => headStates[groupName] ?? DEFAULT_STATE,
    [groupName, headStates],
  );
}

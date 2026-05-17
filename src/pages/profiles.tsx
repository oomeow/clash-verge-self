import { isSortable } from "@dnd-kit/dom/sortable";
import { arrayMove } from "@dnd-kit/helpers";
import { DragDropProvider, DragOverlay } from "@dnd-kit/react";
import CheckCircle from "@mui/icons-material/CheckCircle";
import ClearRounded from "@mui/icons-material/ClearRounded";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import Delete from "@mui/icons-material/Delete";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import TextSnippetOutlined from "@mui/icons-material/TextSnippetOutlined";
import { Box, Button, Divider, IconButton } from "@mui/material";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useLockFn } from "ahooks";
import { isEqual } from "lodash-es";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  BasePage,
  BaseStyledTextField,
  DialogRef,
  SortableItem,
} from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { ConfirmViewer } from "@/components/profile/confirm-viewer";
import { ProfileItem } from "@/components/profile/profile-item";
import { ProfileMore } from "@/components/profile/profile-more";
import {
  ProfileViewer,
  ProfileViewerRef,
} from "@/components/profile/profile-viewer";
import { ConfigViewer } from "@/components/setting/mods/config-viewer";
import { useLoadingCacheStore, useProfilesStore } from "@/stores";

const compactUids = (uids: (string | undefined)[]) =>
  Array.from(new Set(uids.filter((uid): uid is string => !!uid)));

const getEnabledUids = (items: IProfileItem[]) =>
  items.filter((item) => item.enable).map((item) => item.uid);

type ISortableProfileItem = IProfileItem & {
  id: string;
};

const ProfilePage = () => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const viewerRef = useRef<ProfileViewerRef>(null);
  const configRef = useRef<DialogRef>(null);

  const [url, setUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [selectionCategory, setSelectionCategory] = useState<
    "profile" | "chain" | null
  >(null);

  const currentProfileUid = useProfilesStore((s) => s.currentProfile?.uid);
  const profileItems = useProfilesStore((s) => s.profileItems);
  const globalChainItems = useProfilesStore((s) => s.globalChainItems);
  const enabledGlobalChainUids = useMemo(
    () => getEnabledUids(globalChainItems),
    [globalChainItems],
  );
  const patchConfig = useProfilesStore((s) => s.patchConfig);
  const patchProfile = useProfilesStore((s) => s.patchProfile);
  const refreshConfig = useProfilesStore((s) => s.refreshConfig);
  const importProfile = useProfilesStore((s) => s.importProfile);
  const reorderProfile = useProfilesStore((s) => s.reorderProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
  const batchDeleteProfiles = useProfilesStore((s) => s.batchDeleteProfiles);
  const batchToggleChainsEnable = useProfilesStore(
    (s) => s.batchToggleChainsEnable,
  );
  const updateProfile = useProfilesStore((s) => s.updateProfile);
  const enhanceProfiles = useProfilesStore((s) => s.enhanceProfiles);
  const activatingItemUids = useProfilesStore((s) => s.activatingItemUids);
  const setActivatingItemUids = useProfilesStore(
    (s) => s.setActivatingItemUids,
  );
  const clearActivatingItemUids = useProfilesStore(
    (s) => s.clearActivatingItemUids,
  );
  const chainLogs = useProfilesStore((s) => s.chainLogs);

  const [sortableProfileItems, setSortableProfileItems] = useState<
    ISortableProfileItem[]
  >(profileItems.map((item) => ({ id: item.uid, ...item })));
  const [sortableGlobalChainItems, setSortableGlobalChainItems] = useState<
    ISortableProfileItem[]
  >(globalChainItems.map((item) => ({ id: item.uid, ...item })));

  useEffect(() => {
    setSortableProfileItems(
      profileItems.map((item) => ({ id: item.uid, ...item })),
    );
  }, [profileItems]);

  useEffect(() => {
    setSortableGlobalChainItems(
      globalChainItems.map((item) => ({ id: item.uid, ...item })),
    );
  }, [globalChainItems]);

  const activatingUidSet = useMemo(
    () => new Set(activatingItemUids),
    [activatingItemUids],
  );
  const hasActivatingItems = activatingItemUids.length > 0;

  const getActivationUids = useCallback(
    (...uids: (string | undefined)[]) =>
      compactUids([...uids, ...enabledGlobalChainUids]),
    [enabledGlobalChainUids],
  );

  const clearActivationUids = useCallback(
    (uids: string[], delay?: number) => {
      const clear = () => clearActivatingItemUids(uids);
      if (delay) {
        setTimeout(clear, delay);
        return;
      }
      clear();
    },
    [clearActivatingItemUids],
  );

  const startActivation = useCallback(
    (uids: string[]) => {
      if (uids.length > 0) {
        setActivatingItemUids(uids);
      }
    },
    [setActivatingItemUids],
  );

  const handleToggleSelect = useCallback(
    (uid: string, category: "profile" | "chain") => {
      setSelectedUids((prev) => {
        const next = prev.includes(uid)
          ? prev.filter((id) => id !== uid)
          : [...prev, uid];

        if (prev.length === 0 && next.length === 1) {
          setSelectionCategory(category);
        } else if (prev.length === 1 && next.length === 0) {
          setSelectionCategory(null);
        }
        return next;
      });
    },
    [selectionCategory, notice],
  );

  const onEnhance = useLockFn(async () => {
    const nextActivatingItemUids = getActivationUids(currentProfileUid);
    try {
      startActivation(nextActivatingItemUids);
      await enhanceProfiles();
      notice("success", t("messages.profiles.reactivated"), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString(), 3000);
    } finally {
      clearActivationUids(nextActivatingItemUids);
    }
  });

  const onImport = useCallback(async () => {
    if (!url) return;
    setImportLoading(true);

    try {
      const newProfiles = await importProfile(url);
      notice("success", t("messages.profiles.imported"));
      setUrl("");

      const remoteItem = newProfiles.items?.find((e) => e.type === "remote");
      if (!newProfiles.current && remoteItem) {
        await patchConfig({ current: remoteItem.uid });
      }
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      setImportLoading(false);
    }
  }, [importProfile, notice, patchConfig, t, url]);

  const onSelect = useLockFn(async (current: string) => {
    if (current === currentProfileUid || hasActivatingItems) return;
    const nextActivatingItemUids = getActivationUids(current);
    try {
      startActivation(nextActivatingItemUids);
      await patchConfig({ current });
      notice("success", t("messages.profiles.switched"), 1000);
    } catch (err: any) {
      notice("error", err.message || err.toString(), 4000);
    } finally {
      clearActivationUids(nextActivatingItemUids);
    }
  });

  const onDelete = useLockFn(async (uid: string) => {
    const isEnable =
      currentProfileUid === uid || enabledGlobalChainUids.includes(uid);
    const nextActivatingItemUids = getActivationUids(currentProfileUid, uid);
    try {
      if (isEnable) {
        startActivation(nextActivatingItemUids);
      }
      await deleteProfile(uid);
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      if (isEnable) {
        clearActivationUids(nextActivatingItemUids);
      }
    }
  });

  const handleToggleEnable = useLockFn(
    async (chainUid: string, enable: boolean) => {
      const nextActivatingItemUids = getActivationUids(
        currentProfileUid,
        chainUid,
      );
      try {
        startActivation(nextActivatingItemUids);
        await patchProfile(chainUid, { enable });
        notice("success", t("messages.profiles.reactivated"), 1000);
      } catch (error) {
        console.error(error);
      } finally {
        clearActivationUids(nextActivatingItemUids, 500);
      }
    },
  );

  const handleChainDelete = useLockFn(async (item: IProfileItem) => {
    const nextActivatingItemUids = getActivationUids(
      currentProfileUid,
      item.uid,
    );
    try {
      if (item.enable) {
        startActivation(nextActivatingItemUids);
      }
      await deleteProfile(item.uid);
      if (item.enable) {
        await onEnhance();
      }
    } catch (error: any) {
      notice("error", error.message || error.toString());
    } finally {
      if (item.enable) {
        clearActivationUids(nextActivatingItemUids);
      }
    }
  });

  // 更新所有订阅
  const setLoading = useLoadingCacheStore((s) => s.setLoading);
  const loadingCache = useLoadingCacheStore((s) => s.loadingCache);
  const onUpdateAll = useLockFn(async () => {
    const updateOne = async (uid: string) => {
      try {
        await updateProfile(uid);
      } finally {
        setLoading(uid, false);
      }
    };

    return new Promise((resolve) => {
      const items = profileItems.filter(
        (e) => e.type === "remote" && !loadingCache[e.uid],
      );

      // Set loading state for each item
      items.forEach((e) => setLoading(e.uid, true));

      Promise.allSettled(items.map((e) => updateOne(e.uid))).then(resolve);
    });
  });

  const onCopyLink = useCallback(async () => {
    const text = await readText();
    if (text) setUrl(text);
  }, []);

  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);

  const exitSelectMode = useCallback(() => {
    setSelectedUids([]);
    setSelectionCategory(null);
    setSelectMode(false);
  }, []);

  const handleBatchToggleChainsEnable = useLockFn(async (enable: boolean) => {
    const togglingUids = [...selectedUids];
    const activatingUids = getActivationUids(
      currentProfileUid,
      ...togglingUids,
    );
    try {
      startActivation(activatingUids);
      await batchToggleChainsEnable(togglingUids, enable);
      notice(
        "success",
        t("messages.profiles.batchToggleSuccess", {
          count: togglingUids.length,
        }),
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      clearActivatingItemUids(activatingUids);
      exitSelectMode();
    }
  });

  const handleBatchDelete = useLockFn(async () => {
    const deletingUids = [...selectedUids];
    const anyEnabled = deletingUids.some(
      (uid) =>
        uid === currentProfileUid || enabledGlobalChainUids.includes(uid),
    );
    const activatingUids = anyEnabled
      ? getActivationUids(currentProfileUid, ...deletingUids)
      : [];
    try {
      if (anyEnabled) startActivation(activatingUids);
      await batchDeleteProfiles(deletingUids);
      notice(
        "success",
        t("messages.profiles.batchDeleteSuccess", {
          count: deletingUids.length,
        }),
      );
    } catch (err: any) {
      notice("error", err.message || err.toString());
    } finally {
      if (anyEnabled) clearActivatingItemUids(activatingUids);
      setBatchDeleteOpen(false);
      exitSelectMode();
    }
  });

  return (
    <BasePage
      full
      title={t("pages.profiles.title")}
      header={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            color={selectMode ? "error" : "inherit"}
            startIcon={selectMode ? undefined : <CheckCircle />}
            sx={{
              minWidth: 60,
              whiteSpace: "nowrap",
              borderColor: selectMode ? "error.main" : "divider",
            }}
            onClick={() => {
              if (selectMode) {
                exitSelectMode();
              } else {
                setSelectMode(true);
              }
            }}>
            {selectMode
              ? `${t("common.actions.cancel")}${selectedUids.length > 0 ? ` (${selectedUids.length})` : ""}`
              : t("pages.profiles.actions.selectMode")}
          </Button>
          <IconButton
            size="small"
            color="inherit"
            title={t("pages.profiles.actions.updateAllProfiles")}
            onClick={() => onUpdateAll()}>
            <RefreshRounded />
          </IconButton>

          <IconButton
            size="small"
            color="inherit"
            title={t("pages.profiles.actions.viewRuntimeConfig")}
            onClick={() => configRef.current?.open()}>
            <TextSnippetOutlined />
          </IconButton>

          <Button
            size="small"
            loading={hasActivatingItems}
            loadingPosition="end"
            variant="contained"
            color="primary"
            endIcon={<LocalFireDepartmentRounded />}
            title={t("pages.profiles.actions.reactivateProfiles")}
            onClick={() => onEnhance()}>
            <span>{t("pages.profiles.actions.reactivateProfiles")}</span>
          </Button>
        </Box>
      }>
      <div className="bg-background-default sticky top-0 z-10 mb-1 flex items-center space-x-2! px-2 pt-2 pb-1">
        <BaseStyledTextField
          value={url}
          sx={{ flex: 1 }}
          variant="outlined"
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("pages.profiles.inputs.profileUrl")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && url.length > 0) {
              onImport();
            }
          }}
          slotProps={{
            input: {
              sx: { pr: 1 },
              endAdornment: !url ? (
                <IconButton
                  size="small"
                  color="primary"
                  sx={{ p: 0.5 }}
                  title={t("pages.profiles.actions.paste")}
                  onClick={() => onCopyLink()}>
                  <ContentPasteRounded fontSize="inherit" />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  color="primary"
                  sx={{ p: 0.5 }}
                  title={t("common.actions.clear")}
                  onClick={() => setUrl("")}>
                  <ClearRounded fontSize="inherit" />
                </IconButton>
              ),
            },
          }}
        />
        <Button
          disabled={!url}
          loading={importLoading}
          variant="contained"
          size="small"
          sx={{ borderRadius: "6px" }}
          onClick={() => onImport()}>
          {t("common.actions.import")}
        </Button>
        <Button
          variant="contained"
          size="small"
          sx={{ borderRadius: "6px" }}
          onClick={() => viewerRef.current?.create(null)}>
          {t("common.actions.new")}
        </Button>
      </div>
      <div className="px-2">
        <Box
          sx={{
            transition: "opacity 0.2s",
            ...(selectMode &&
              selectionCategory === "chain" && {
                opacity: 0.35,
                pointerEvents: "none",
              }),
          }}>
          <DragDropProvider
            onDragOver={(e) => {
              // Prevent drag-and-drop when activating items or multi-select mode
              if (hasActivatingItems || selectMode) e.preventDefault();
            }}
            onDragEnd={async (event) => {
              const { operation, canceled } = event;
              const { source, target } = operation;

              if (canceled) return;

              if (target && isSortable(source)) {
                const newIndex = source.sortable.index;
                const oldIndex = source.sortable.initialIndex;
                if (oldIndex === newIndex) return;
                const activeId = sortableProfileItems[oldIndex].uid;
                const overId = sortableProfileItems[newIndex].uid;

                const newProfileList = arrayMove(
                  sortableProfileItems,
                  oldIndex,
                  newIndex,
                );
                await reorderProfile(activeId, overId);
                setSortableProfileItems(newProfileList);
              }
            }}>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 px-2">
              {sortableProfileItems.map((item, index) => {
                return (
                  <SortableItem key={item.uid} id={item.uid} index={index}>
                    <ProfileItem
                      selected={
                        activatingUidSet.has(item.uid) ||
                        (!hasActivatingItems && currentProfileUid === item.uid)
                      }
                      activating={activatingUidSet.has(item.uid)}
                      itemData={item}
                      onSelect={
                        selectMode
                          ? (uid: string) => handleToggleSelect(uid, "profile")
                          : onSelect
                      }
                      onDelete={onDelete}
                      onActivatedSave={onEnhance}
                      selectMode={selectMode}
                      multiSelected={
                        selectMode && selectionCategory === "profile"
                          ? selectedUids.includes(item.uid)
                          : false
                      }
                    />
                  </SortableItem>
                );
              })}
            </div>
            <DragOverlay>
              {(source) => {
                const draggingItem = sortableProfileItems.find(
                  (item) => item.uid === source.id,
                );
                if (!draggingItem) return null;
                return (
                  <ProfileItem
                    sx={{
                      borderRadius: "8px",
                      boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                    }}
                    selected={
                      activatingUidSet.has(draggingItem.uid) ||
                      (!hasActivatingItems &&
                        currentProfileUid === draggingItem.uid)
                    }
                    activating={activatingUidSet.has(draggingItem.uid)}
                    itemData={draggingItem}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onActivatedSave={onEnhance}
                  />
                );
              }}
            </DragOverlay>
          </DragDropProvider>
        </Box>

        {globalChainItems.length > 0 && (
          <>
            <Divider
              variant="middle"
              flexItem
              sx={(theme) => ({
                width: "calc(100% - 32px)",
                my: 1,
                borderColor: "rgba(0, 0, 0, 0.06)",
                ...theme.applyStyles("dark", {
                  borderColor: "rgba(255, 255, 255, 0.06)",
                }),
              })}>
              {t("pages.profiles.actions.enhanceScripts")}
            </Divider>
            <Box
              sx={{
                transition: "opacity 0.2s",
                ...(selectMode &&
                  selectionCategory === "profile" && {
                    opacity: 0.35,
                    pointerEvents: "none",
                  }),
              }}>
              <DragDropProvider
                onDragOver={(e) => {
                  if (hasActivatingItems || selectMode) e.preventDefault();
                }}
                onDragEnd={async (event) => {
                  const { operation, canceled } = event;
                  const { source, target } = operation;

                  if (canceled) return;

                  if (target && isSortable(source)) {
                    const newIndex = source.sortable.index;
                    const oldIndex = source.sortable.initialIndex;
                    if (newIndex === oldIndex) return;
                    const activeId = sortableGlobalChainItems[oldIndex].uid;
                    const overId = sortableGlobalChainItems[newIndex].uid;

                    const newChainList = arrayMove(
                      sortableGlobalChainItems,
                      oldIndex,
                      newIndex,
                    );
                    const needToEnhance = !isEqual(
                      enabledGlobalChainUids,
                      getEnabledUids(newChainList),
                    );

                    await reorderProfile(activeId, overId);
                    setSortableGlobalChainItems(newChainList);

                    if (needToEnhance) {
                      await onEnhance();
                    }
                  }
                }}>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 px-2">
                  {sortableGlobalChainItems.map((item, index) => {
                    return (
                      <SortableItem key={item.id} id={item.uid} index={index}>
                        <ProfileMore
                          selected={
                            activatingUidSet.has(item.uid) || !!item.enable
                          }
                          itemData={item}
                          logs={chainLogs[item.uid]}
                          reactivating={activatingUidSet.has(item.uid)}
                          onToggleEnable={handleToggleEnable}
                          onDelete={handleChainDelete}
                          onActivatedSave={onEnhance}
                          onClick={
                            selectMode
                              ? (uid: string) =>
                                  handleToggleSelect(uid, "chain")
                              : undefined
                          }
                          selectMode={selectMode}
                          multiSelected={
                            selectMode && selectionCategory === "chain"
                              ? selectedUids.includes(item.uid)
                              : false
                          }
                        />
                      </SortableItem>
                    );
                  })}
                </div>
                <DragOverlay>
                  {(source) => {
                    const draggingItem = sortableGlobalChainItems.find(
                      (item) => item.id === source.id,
                    );
                    if (!draggingItem) return null;
                    return (
                      <ProfileMore
                        selected={
                          activatingUidSet.has(draggingItem.uid) ||
                          !!draggingItem.enable
                        }
                        itemData={draggingItem}
                        sx={{
                          borderRadius: "8px",
                          boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                        }}
                        logs={chainLogs[draggingItem.uid]}
                        reactivating={activatingUidSet.has(draggingItem.uid)}
                        onToggleEnable={handleToggleEnable}
                        onActivatedSave={onEnhance}
                      />
                    );
                  }}
                </DragOverlay>
              </DragDropProvider>
            </Box>
          </>
        )}
      </div>
      <ProfileViewer ref={viewerRef} onChange={() => refreshConfig()} />
      <ConfigViewer ref={configRef} />

      {selectMode && selectedUids.length > 0 && (
        <div className="bg-background-paper absolute right-3 bottom-3 left-3 z-10 flex items-center justify-center gap-2 rounded-xl py-2 shadow-md">
          {selectionCategory === "chain" && (
            <>
              <Button
                variant="contained"
                color="success"
                size="small"
                onClick={() => handleBatchToggleChainsEnable(true)}>
                {t("pages.profiles.actions.enableSelected", {
                  count: selectedUids.length,
                })}
              </Button>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                onClick={() => handleBatchToggleChainsEnable(false)}>
                {t("pages.profiles.actions.disableSelected", {
                  count: selectedUids.length,
                })}
              </Button>
            </>
          )}
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<Delete />}
            onClick={() => setBatchDeleteOpen(true)}>
            {t("pages.profiles.actions.deleteSelected", {
              count: selectedUids.length,
            })}
          </Button>
        </div>
      )}

      <ConfirmViewer
        title={t("pages.profiles.dialog.confirmBatchDeletion", {
          count: selectedUids.length,
        })}
        message={t("pages.profiles.dialog.confirmBatchDeletionMessage")}
        open={batchDeleteOpen}
        onClose={() => setBatchDeleteOpen(false)}
        onConfirm={handleBatchDelete}
      />
    </BasePage>
  );
};

export default ProfilePage;

import {
  closestCenter,
  defaultDropAnimationSideEffects,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DropAnimation,
  MouseSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
} from "@dnd-kit/sortable";
import ClearRounded from "@mui/icons-material/ClearRounded";
import ContentPasteRounded from "@mui/icons-material/ContentPasteRounded";
import LocalFireDepartmentRounded from "@mui/icons-material/LocalFireDepartmentRounded";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import TextSnippetOutlined from "@mui/icons-material/TextSnippetOutlined";
import { Box, Button, Divider, IconButton } from "@mui/material";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { useLockFn, useMemoizedFn } from "ahooks";
import { isEqual } from "lodash-es";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import {
  BasePage,
  BaseStyledTextField,
  DialogRef,
  DraggableItem,
} from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { ProfileItem } from "@/components/profile/profile-item";
import { ProfileMore } from "@/components/profile/profile-more";
import {
  ProfileViewer,
  ProfileViewerRef,
} from "@/components/profile/profile-viewer";
import { ConfigViewer } from "@/components/setting/mods/config-viewer";
import { useLoadingCacheStore, useProfilesStore } from "@/stores";

const FlexDecorationItems = memo(function FlexDecoratorItems() {
  return [...Array(20)].map((_, index) => (
    <i key={index} className="mx-1.25 my-0 flex h-0 w-65 grow"></i>
  ));
});

const compactUids = (uids: (string | undefined)[]) =>
  Array.from(new Set(uids.filter((uid): uid is string => !!uid)));

const getEnabledUids = (items: IProfileItem[]) =>
  items.filter((item) => item.enable).map((item) => item.uid);

const reorderItems = (
  items: IProfileItem[],
  activeId: string,
  overId: string,
) =>
  arrayMove(
    items,
    items.findIndex((item) => item.uid === activeId),
    items.findIndex((item) => item.uid === overId),
  );

const ProfilePage = () => {
  const { t } = useTranslation();
  const { notice } = useNotice();

  const viewerRef = useRef<ProfileViewerRef>(null);
  const configRef = useRef<DialogRef>(null);

  const [url, setUrl] = useState("");
  const [disabled, setDisabled] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [draggingItem, setDraggingItem] = useState<IProfileItem | null>(null);
  const [overItemWidth, setOverItemWidth] = useState(260);

  const config = useProfilesStore((s) => s.config);
  const profileItems = useProfilesStore((s) => s.profileItems);
  const globalChainItems = useProfilesStore((s) => s.globalChainItems);
  const enabledGlobalChainUids = useProfilesStore(
    (s) => s.enabledGlobalChainUids,
  );
  const patchConfig = useProfilesStore((s) => s.patchConfig);
  const patchProfile = useProfilesStore((s) => s.patchProfile);
  const refreshConfig = useProfilesStore((s) => s.refreshConfig);
  const refreshChainLogs = useProfilesStore((s) => s.refreshChainLogs);
  const importProfile = useProfilesStore((s) => s.importProfile);
  const reorderProfile = useProfilesStore((s) => s.reorderProfile);
  const deleteProfile = useProfilesStore((s) => s.deleteProfile);
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

  const activatingUidSet = useMemo(
    () => new Set(activatingItemUids),
    [activatingItemUids],
  );
  const profileSortableIds = useMemo(
    () => profileItems.map((item) => item.uid),
    [profileItems],
  );
  const chainSortableIds = useMemo(
    () => globalChainItems.map((item) => item.uid),
    [globalChainItems],
  );
  const hasActivatingItems = activatingItemUids.length > 0;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
  );
  const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  useEffect(() => {
    refreshConfig();
    refreshChainLogs();
  }, [refreshChainLogs, refreshConfig]);

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

  const handleDragOver = useCallback(
    (items: IProfileItem[], activeId: string, width?: number) => {
      if (width && width !== overItemWidth) {
        setOverItemWidth(width);
      }
      setDraggingItem(items.find((item) => item.uid === activeId) ?? null);
    },
    [overItemWidth],
  );

  const onEnhance = useLockFn(async () => {
    const nextActivatingItemUids = getActivationUids(config.current);
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

  const handleProfileDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggingItem(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id.toString();
      const overId = over.id.toString();
      await reorderProfile(activeId, overId);
    },
    [reorderProfile],
  );

  const handleChainDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setDraggingItem(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeId = active.id.toString();
      const overId = over.id.toString();
      const newChainList = reorderItems(globalChainItems, activeId, overId);
      const needToEnhance = !isEqual(
        enabledGlobalChainUids,
        getEnabledUids(newChainList),
      );

      await reorderProfile(activeId, overId);
      if (needToEnhance) {
        await onEnhance();
      }
    },
    [globalChainItems, enabledGlobalChainUids, onEnhance, reorderProfile],
  );

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
      setDisabled(false);
      setImportLoading(false);
    }
  }, [importProfile, notice, patchConfig, t, url]);

  const onSelect = useLockFn(async (current: string, _force: boolean) => {
    if (current === config.current || hasActivatingItems) return;
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
      config.current === uid || enabledGlobalChainUids.includes(uid);
    const nextActivatingItemUids = getActivationUids(config.current, uid);
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
        config.current,
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
    const nextActivatingItemUids = getActivationUids(config.current, item.uid);
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
  const onUpdateAll = useMemoizedFn(
    useLockFn(async () => {
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
    }),
  );

  const onCopyLink = useCallback(async () => {
    const text = await readText();
    if (text) setUrl(text);
  }, []);

  return (
    <BasePage
      full
      title={t("pages.profiles.title")}
      header={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
      <div className="bg-comment sticky top-0 z-10 mb-1 flex items-center space-x-2! px-2 pt-2 pb-1">
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
          disabled={!url || disabled}
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
      <Box sx={{ px: "10px" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragOver={(event) => {
            const { over } = event;
            if (over) {
              handleDragOver(
                profileItems,
                event.active.id.toString(),
                event.over?.rect.width,
              );
            }
          }}
          onDragEnd={(e) => handleProfileDragEnd(e)}
          onDragCancel={() => setDraggingItem(null)}>
          <Box>
            <SortableContext items={profileSortableIds}>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                {profileItems.map((item) => (
                  <DraggableItem
                    key={item.uid}
                    id={item.uid}
                    sx={{
                      display: "flex",
                      flexGrow: 1,
                      width: "260px",
                      margin: "5px",
                    }}>
                    <ProfileItem
                      selected={
                        activatingUidSet.has(item.uid) ||
                        (!hasActivatingItems && config.current === item.uid)
                      }
                      isDragging={draggingItem?.uid === item.uid}
                      activating={activatingUidSet.has(item.uid)}
                      itemData={item}
                      onSelect={(f) => onSelect(item.uid, f)}
                      onDelete={() => onDelete(item.uid)}
                      // onEdit={() => viewerRef.current?.edit(item)}
                      onReactivate={() => onEnhance()}
                    />
                  </DraggableItem>
                ))}
                <FlexDecorationItems />
              </Box>
            </SortableContext>
          </Box>
          <DragOverlay dropAnimation={dropAnimationConfig}>
            {draggingItem ? (
              <ProfileItem
                sx={{
                  width: overItemWidth,
                  borderRadius: "8px",
                  boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                }}
                selected={
                  activatingUidSet.has(draggingItem.uid) ||
                  (!hasActivatingItems && config.current === draggingItem.uid)
                }
                activating={activatingUidSet.has(draggingItem.uid)}
                itemData={draggingItem}
                onSelect={(f) => onSelect(draggingItem.uid, f)}
                onDelete={() => onDelete(draggingItem.uid)}
                // onEdit={() => viewerRef.current?.edit(draggingProfileItem)}
                onReactivate={() => onEnhance()}
              />
            ) : null}
          </DragOverlay>
        </DndContext>

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragOver={(event) => {
                const { over } = event;
                if (over) {
                  handleDragOver(
                    globalChainItems,
                    event.active.id.toString(),
                    event.over?.rect.width,
                  );
                }
              }}
              onDragEnd={(e) => handleChainDragEnd(e)}
              onDragCancel={() => setDraggingItem(null)}>
              <Box sx={{ display: "flex", flexWrap: "wrap" }}>
                <SortableContext
                  items={chainSortableIds}
                  strategy={rectSortingStrategy}>
                  {globalChainItems.map((item) => (
                    <DraggableItem
                      key={item.uid}
                      id={item.uid}
                      data={{
                        activated: enabledGlobalChainUids.includes(item.uid),
                      }}
                      sx={{
                        display: "flex",
                        flexGrow: 1,
                        width: "260px",
                        margin: "5px",
                      }}>
                      <ProfileMore
                        selected={
                          activatingUidSet.has(item.uid) || !!item.enable
                        }
                        isDragging={draggingItem?.uid === item.uid}
                        itemData={item}
                        logs={chainLogs[item.uid]}
                        reactivating={activatingItemUids.includes(item.uid)}
                        onToggleEnable={async (enable) => {
                          handleToggleEnable(item.uid, enable);
                        }}
                        onDelete={() => handleChainDelete(item)}
                        onActivatedSave={() => onEnhance()}
                      />
                    </DraggableItem>
                  ))}
                </SortableContext>
                <FlexDecorationItems />
              </Box>
              {createPortal(
                <DragOverlay dropAnimation={dropAnimationConfig}>
                  {draggingItem ? (
                    <ProfileMore
                      selected={
                        activatingUidSet.has(draggingItem.uid) ||
                        !!draggingItem.enable
                      }
                      itemData={draggingItem}
                      sx={{
                        width: overItemWidth,
                        borderRadius: "8px",
                        boxShadow: "0px 0px 10px 5px rgba(0,0,0,0.2)",
                      }}
                      logs={chainLogs[draggingItem.uid]}
                      reactivating={activatingUidSet.has(draggingItem.uid)}
                      onToggleEnable={async (enable) => {
                        handleToggleEnable(draggingItem.uid, enable);
                      }}
                      onActivatedSave={() => onEnhance()}
                    />
                  ) : null}
                </DragOverlay>,
                document.body,
              )}
            </DndContext>
          </>
        )}
      </Box>
      <ProfileViewer ref={viewerRef} onChange={() => refreshConfig()} />
      <ConfigViewer ref={configRef} />
    </BasePage>
  );
};

export default ProfilePage;

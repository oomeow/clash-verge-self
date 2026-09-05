import { getVersion } from "@tauri-apps/api/app";
import { useAsyncEffect, useLockFn } from "ahooks";
import { isEqual } from "lodash-es";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { BaseDialog } from "@/components/base";
import { useNotice } from "@/components/base/notifies";
import { ConfirmViewer } from "@/components/profile/confirm-viewer";
import {
  ProfileEditor,
  type ProfileEditorHandle,
} from "@/components/profile/profile-editor";
import { ProfileEditorSidebar } from "@/components/profile/profile-editor-sidebar";
import { useProfilesStore } from "@/stores";
import { getErrorMessage, sleep } from "@/utils";

interface Props {
  title?: string | ReactNode;
  profileItem: IProfileItem;
  open: boolean;
  type?: "clash" | "merge" | "script";
  onClose: () => void;
  onChange?: () => void;
}

export const ProfileEditorViewer = (props: Props) => {
  const { title, profileItem, open, type, onClose, onChange } = props;
  const { t } = useTranslation();
  const { notice } = useNotice();

  const profileUid = profileItem.uid;
  const isRemote = profileItem.type === "remote";
  const viewerType: "clash" | "merge" | "script" =
    type ??
    (profileItem.type === "script"
      ? "script"
      : profileItem.type === "merge"
        ? "merge"
        : "clash");

  const profileEditorRef = useRef<ProfileEditorHandle>(null);
  const resolveRef = useRef<(status: boolean) => void>(null);
  const [editProfile, setEditProfile] = useState<IProfileItem>(profileItem);
  const [curContentSaved, setCurContentSaved] = useState(true);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const patchProfile = useProfilesStore((s) => s.patchProfile);

  const formMethods = useForm<IProfileItem>({
    defaultValues: profileItem,
  });

  // 打开时若为 remote 则回填默认 User-Agent
  useAsyncEffect(async () => {
    if (!open || !isRemote) return;
    const version = await getVersion();
    formMethods.setValue("option.user_agent", `clash-verge/${version}`);
  }, [open, isRemote]);

  const showConfirm = () => {
    setSaveConfirmOpen(true);
    return new Promise((resolve: (status: boolean) => void) => {
      resolveRef.current = resolve;
    });
  };

  const handleConfirm = useCallback(() => {
    setSaveConfirmOpen(false);
    setCurContentSaved(true);
    resolveRef.current?.(true);
  }, []);

  const handleCancel = useCallback(() => {
    setSaveConfirmOpen(false);
    profileEditorRef.current?.reset();
    setCurContentSaved(true);
    resolveRef.current?.(false);
  }, []);

  const saveEditorContent = useCallback(async () => {
    const saveStatus = !!(await profileEditorRef.current?.save());
    if (!saveStatus) {
      notice("error", t("messages.profiles.contentSaveFailed"));
      return false;
    }
    await sleep(1000);
    return true;
  }, [notice, t]);

  const handleProfileSubmit = useLockFn(
    formMethods.handleSubmit(async (form) => {
      const isSame = isEqual(form, profileItem);
      if (isSame) {
        notice("info", t("messages.profiles.configUnchanged"));
        return;
      }
      try {
        if (!form.type) throw new Error("`Type` should not be null");
        if (!form.name) {
          throw new Error("The name should not be empty");
        }
        if (form.type === "remote" && !form.url) {
          throw new Error("The URL should not be null");
        }
        if (form.type !== "remote" && form.type !== "local") {
          delete form.option;
        }
        if (form.option?.update_interval) {
          form.option.update_interval = +form.option.update_interval;
        } else {
          delete form.option?.update_interval;
        }
        if (form.option?.user_agent === "") {
          delete form.option.user_agent;
        }
        if (profileItem.enable) {
          form.enable = profileItem.enable;
        }
        const item = { ...form };

        if (!form.uid) throw new Error("UID not found");
        await patchProfile(form.uid, item);
        notice("success", t("messages.profiles.configUpdated"));
      } catch (err: unknown) {
        notice("error", getErrorMessage(err));
      }
    }),
  );

  const handleChainClick = useCallback(
    async (item: IProfileItem) => {
      if (!curContentSaved) {
        const status = await showConfirm();
        if (status) {
          const saveStatus = await saveEditorContent();
          if (!saveStatus) return;
        }
      }
      const backToOriginalProfile = editProfile.uid === item.uid;
      if (backToOriginalProfile) {
        // 两次点击，表示编辑主配置文件内容
        setEditProfile(profileItem);
      } else {
        setEditProfile(item);
      }
    },
    [curContentSaved, editProfile, profileItem, saveEditorContent],
  );

  const handleChainDeleted = useCallback(
    async (item: IProfileItem) => {
      if (item.uid === editProfile.uid) {
        setEditProfile(profileItem);
      }
    },
    [editProfile, profileItem],
  );

  const handleEditorChange = useCallback(() => setCurContentSaved(false), []);
  const handleEditorReset = useCallback(() => setCurContentSaved(true), []);
  const handleEditorSave = useCallback(() => {
    setCurContentSaved(true);
    if (editProfile.enable || editProfile.uid === profileUid) {
      onChange?.();
    }
  }, [editProfile, onChange, profileUid]);

  const onSave = useLockFn(async () => {
    try {
      setSaving(true);
      if (!curContentSaved) {
        const saveStatus = await saveEditorContent();
        if (!saveStatus) return;
      }
      await handleProfileSubmit();
    } catch (err: unknown) {
      notice("error", getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  });

  const closeDialog = useCallback(() => {
    setEditProfile(profileItem);
    // 取消/关闭时丢弃本次未保存的编辑：
    // 表单回到存储值（避免重新打开时残留旧输入）、编辑器内容还原、清空未保存标记
    profileEditorRef.current?.reset();
    formMethods.reset(profileItem);
    setCurContentSaved(true);
    onClose();
  }, [onClose, profileItem, formMethods]);

  return (
    <BaseDialog
      full
      open={open}
      title={title ?? t("pages.profiles.actions.editFile")}
      cancelBtn={t("common.actions.cancel")}
      okBtn={t("common.actions.save")}
      onClose={closeDialog}
      onCancel={closeDialog}
      loading={saving}
      onOk={onSave}
      contentStyle={{ userSelect: "text" }}>
      <FormProvider {...formMethods}>
        <div className="bg-background-paper flex h-full overflow-hidden">
          <ProfileEditorSidebar
            profileUid={profileUid}
            profileItem={profileItem}
            type={viewerType}
            selectedUid={editProfile.uid}
            onActivate={handleChainClick}
            onChainDeleted={handleChainDeleted}
          />

          <ProfileEditor
            ref={profileEditorRef}
            parentUid={editProfile.parent}
            profileItem={editProfile}
            onChange={handleEditorChange}
            onReset={handleEditorReset}
            onSave={handleEditorSave}
          />

          <ConfirmViewer
            title={t("messages.profiles.saveContent", { keymap: "" })}
            open={saveConfirmOpen}
            message={t("messages.profiles.askSaveContentNow")}
            onConfirm={handleConfirm}
            onClose={handleCancel}
          />
        </div>
      </FormProvider>
    </BaseDialog>
  );
};

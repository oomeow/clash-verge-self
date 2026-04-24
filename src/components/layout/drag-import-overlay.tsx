import { listen, TauriEvent } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { mutate } from "swr";

import { useNotice } from "@/components/base/notifies";
import { router } from "@/router";
import { createProfile } from "@/services/cmds";

type DragImportValidation = {
  paths: string[];
  validPaths: string[];
  invalidPaths: string[];
};

const EMPTY_VALIDATION: DragImportValidation = {
  paths: [],
  validPaths: [],
  invalidPaths: [],
};

const isYamlFile = (file: string) =>
  file.endsWith(".yaml") || file.endsWith(".yml");

const getFileName = (path: string) => path.split(/\/|\\/).pop() ?? path;

const isSameValidation = (
  left: DragImportValidation,
  right: DragImportValidation,
) =>
  left.paths.length === right.paths.length &&
  left.validPaths.length === right.validPaths.length &&
  left.invalidPaths.length === right.invalidPaths.length &&
  left.paths.every((path, index) => path === right.paths[index]) &&
  left.validPaths.every((path, index) => path === right.validPaths[index]) &&
  left.invalidPaths.every((path, index) => path === right.invalidPaths[index]);

const getDragPaths = (payload: unknown) => {
  if (
    payload &&
    typeof payload === "object" &&
    "paths" in payload &&
    Array.isArray(payload.paths)
  ) {
    return payload.paths.filter(
      (path): path is string => typeof path === "string",
    );
  }
  return [];
};

const validateDragPaths = (paths: string[]): DragImportValidation => ({
  paths,
  validPaths: paths.filter(isYamlFile),
  invalidPaths: paths.filter((file) => !isYamlFile(file)),
});

export function DragImportOverlay() {
  const [isDragImportActive, setIsDragImportActive] = useState(false);
  const [dragImportValidation, setDragImportValidation] =
    useState<DragImportValidation>(EMPTY_VALIDATION);
  const isDragImportActiveRef = useRef(isDragImportActive);
  const dragImportValidationRef = useRef(dragImportValidation);
  const { t } = useTranslation();
  const { notice } = useNotice();

  useEffect(() => {
    const syncDragImportActive = (nextValue: boolean) => {
      if (isDragImportActiveRef.current === nextValue) return;
      isDragImportActiveRef.current = nextValue;
      setIsDragImportActive(nextValue);
    };

    const syncDragImportValidation = (nextValidation: DragImportValidation) => {
      if (isSameValidation(dragImportValidationRef.current, nextValidation)) {
        return;
      }
      dragImportValidationRef.current = nextValidation;
      setDragImportValidation(nextValidation);
    };

    const handleDragState = (payload: unknown) => {
      const nextValidation = validateDragPaths(getDragPaths(payload));
      const currentValidation = dragImportValidationRef.current;
      const shouldUpdateValidation = !isSameValidation(
        currentValidation,
        nextValidation,
      );

      if (isDragImportActiveRef.current && !shouldUpdateValidation) return;

      if (!isDragImportActiveRef.current) {
        syncDragImportActive(true);
      }
      if (shouldUpdateValidation) {
        syncDragImportValidation(nextValidation);
      }
    };

    const resetDragState = () => {
      syncDragImportActive(false);
      syncDragImportValidation(EMPTY_VALIDATION);
    };

    const unlistenDragEnter = listen(TauriEvent.DRAG_ENTER, (event) => {
      getCurrentWebviewWindow().setFocus();
      handleDragState(event.payload);
    });

    const unlistenDragLeave = listen(TauriEvent.DRAG_LEAVE, () => {
      resetDragState();
    });

    const unlistenDragDrop = listen(TauriEvent.DRAG_DROP, async (event) => {
      const nextValidation = validateDragPaths(getDragPaths(event.payload));
      const currentValidation =
        nextValidation.paths.length > 0
          ? nextValidation
          : dragImportValidationRef.current;
      resetDragState();

      if (currentValidation.invalidPaths.length > 0) {
        const invalidFileNames = currentValidation.invalidPaths
          .map(getFileName)
          .join(", ");
        notice(
          "error",
          t("messages.profiles.unsupportedFiles", {
            files: invalidFileNames,
          }),
        );
      }

      for (const file of currentValidation.validPaths) {
        const filename = getFileName(file).replace(/\.ya?ml$/i, "");
        const item = {
          type: "local",
          name: filename || "New Profile",
          desc: "",
          url: "",
          option: {
            with_proxy: false,
            self_proxy: false,
          },
        } as IProfileItem;
        const data = await readTextFile(file);
        await createProfile(item, data);
      }

      if (currentValidation.validPaths.length > 0) {
        mutate("getProfiles");
        router.navigate({ to: "/profiles" });
      }
    });

    return () => {
      unlistenDragEnter.then((fn) => fn());
      unlistenDragLeave.then((fn) => fn());
      unlistenDragDrop.then((fn) => fn());
    };
  }, [notice, t]);

  const validDragImportCount = dragImportValidation.validPaths.length;
  const hasInvalidDragImport = dragImportValidation.invalidPaths.length > 0;
  const draggedFiles = dragImportValidation.paths.map((path) => {
    const name = getFileName(path);
    const importable = dragImportValidation.validPaths.includes(path);
    return { path, name, importable };
  });

  if (!isDragImportActive) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden bg-black/24 backdrop-blur-md">
      <div className="border-primary/30 absolute inset-3 rounded-[22px] border bg-(--background-color-alpha) shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]" />
      <div className="bg-primary/10 absolute top-[-10%] left-[8%] h-72 w-72 rounded-full blur-3xl" />
      <div className="bg-primary/12 absolute right-[10%] bottom-[-12%] h-80 w-80 rounded-full blur-3xl" />

      <div className="relative flex h-full w-full flex-col items-center justify-center px-8 text-center">
        <div className="border-primary/24 bg-comment/78 mb-6 flex h-20 w-20 items-center justify-center rounded-full border shadow-[0_10px_30px_rgba(15,23,42,0.14)]">
          <div className="border-primary/35 text-primary flex h-13 w-13 items-center justify-center rounded-full border text-[28px] leading-none">
            +
          </div>
        </div>

        <div className="text-primary-text text-[30px] leading-tight font-semibold">
          {t("pages.profiles.dragImport.title")}
        </div>
        <div className="text-secondary-text mt-3 max-w-140 text-[16px] leading-7">
          {t("pages.profiles.dragImport.description")}
        </div>

        <div className="border-primary/18 bg-comment/76 mt-8 w-full max-w-155 rounded-[20px] border px-6 py-5 shadow-[0_12px_36px_rgba(15,23,42,0.12)]">
          <div className="text-primary-text text-[18px] leading-7 font-medium">
            {validDragImportCount > 0
              ? t("pages.profiles.dragImport.ready", {
                  count: validDragImportCount,
                })
              : t("pages.profiles.dragImport.waiting")}
          </div>
          <div className="text-secondary-text mt-1 text-sm leading-6">
            {hasInvalidDragImport
              ? t("pages.profiles.dragImport.hintWithInvalid")
              : t("pages.profiles.dragImport.hint")}
          </div>

          {draggedFiles.length > 0 && (
            <div className="mt-4 space-y-2 text-left">
              {draggedFiles.map((file) => (
                <div
                  key={file.path}
                  className="border-primary/10 bg-comment/70 flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-primary-text truncate text-sm font-medium">
                      {file.name}
                    </div>
                    <div className="text-secondary-text truncate text-xs">
                      {file.path}
                    </div>
                  </div>

                  <div
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                      file.importable
                        ? "bg-primary/12 text-primary"
                        : "bg-(--mui-palette-error-main)/10 text-(--mui-palette-error-main)"
                    }`}>
                    {file.importable
                      ? t("pages.profiles.dragImport.importable")
                      : t("pages.profiles.dragImport.notImportable")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

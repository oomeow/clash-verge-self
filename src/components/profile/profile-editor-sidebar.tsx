import ExpandMore from "@mui/icons-material/ExpandMore";
import { Collapse, Divider } from "@mui/material";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Marquee } from "@/components/base";
import { ProfileChainList } from "@/components/profile/profile-chain-list";
import { ProfileMetaForm } from "@/components/profile/profile-meta-form";
import { ProfileTypeChip } from "@/components/profile/profile-type-chip";
import { useProfilesStore } from "@/stores";

interface Props {
  profileUid: string;
  profileItem: IProfileItem;
  type: "clash" | "merge" | "script";
  selectedUid: string | null;
  onActivate: (item: IProfileItem) => Promise<void>;
  onChainDeleted: (item: IProfileItem) => Promise<void>;
}

// 头部展示表单中的实时名称，避免顶层订阅 name 导致整树随输入重渲染
const SidebarTitle = () => {
  const name = useWatch({ name: "name" });
  return <span className="text-md font-bold">{name}</span>;
};

export const ProfileEditorSidebar = (props: Props) => {
  const {
    profileUid,
    profileItem,
    type,
    selectedUid,
    onActivate,
    onChainDeleted,
  } = props;
  const { t } = useTranslation();
  const currentProfile = useProfilesStore((s) => s.currentProfile);

  const isEditChain = type === "merge" || type === "script";
  const [expand, setExpand] = useState(isEditChain);
  const isRemote = profileItem.type === "remote";

  return (
    <div className="no-scrollbar w-1/4 min-w-65 overflow-auto">
      <div className="bg-background-paper sticky top-0 z-10">
        <button
          type="button"
          aria-expanded={expand}
          onClick={() => setExpand((prev) => !prev)}
          className="bg-primary/10 flex w-full cursor-pointer items-center justify-between p-2 text-left">
          <Marquee pauseOnHover>
            <SidebarTitle />
          </Marquee>
          <ProfileTypeChip type={currentProfile?.type} />
          <ExpandMore
            fontSize="inherit"
            color="primary"
            style={{
              transform: expand ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s ease-in-out",
            }}
          />
        </button>
      </div>

      <Collapse
        in={expand}
        timeout={"auto"}
        unmountOnExit
        className="mt-2 px-2">
        <ProfileMetaForm isRemote={isRemote} />
      </Collapse>

      {type === "clash" && (
        <>
          <Divider
            variant="fullWidth"
            className="text-text-secondary my-2 text-sm"
            flexItem>
            {t("pages.profiles.actions.enhanceScripts")}
          </Divider>
          <ProfileChainList
            profileUid={profileUid}
            selectedUid={selectedUid}
            onActivate={onActivate}
            onChainDeleted={onChainDeleted}
          />
        </>
      )}
    </div>
  );
};

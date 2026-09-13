import AccountTreeRounded from "@mui/icons-material/AccountTreeRounded";
import type { Theme } from "@mui/material";
import { alpha, IconButton, Tooltip } from "@mui/material";
import { memo } from "react";
import { useTranslation } from "react-i18next";

const JUMP_ICON = <AccountTreeRounded sx={{ fontSize: 15 }} />;

const jumpButtonSx = (theme: Theme) => {
  const isLight = theme.palette.mode === "light";
  return {
    width: 24,
    height: 24,
    borderRadius: 1,
    color: isLight ? theme.palette.primary.main : theme.palette.primary.light,
    bgcolor: alpha(theme.palette.primary.main, isLight ? 0.08 : 0.16),
    "&:hover": {
      bgcolor: alpha(theme.palette.primary.main, isLight ? 0.18 : 0.28),
    },
  };
};

interface Props {
  groupName: string;
  onGroupLocation: (groupName: string) => void;
}

export const ProxyGroupJumpButton = memo(function ProxyGroupJumpButton({
  groupName,
  onGroupLocation,
}: Props) {
  const { t } = useTranslation();

  return (
    <Tooltip
      title={t("pages.proxies.actions.jumpToGroup")}
      placement="top"
      arrow>
      <IconButton
        size="small"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGroupLocation(groupName);
        }}
        sx={jumpButtonSx}>
        {JUMP_ICON}
      </IconButton>
    </Tooltip>
  );
});

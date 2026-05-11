import { alpha, Chip, styled } from "@mui/material";
import { memo } from "react";

type ProfileTypeChipVariant = "default" | "enhance";
type ProfileTypeChipDensity = "default" | "compact";

interface Props {
  type?: IProfileItem["type"];
  variant?: ProfileTypeChipVariant;
  density?: ProfileTypeChipDensity;
}

const DEFAULT_TYPE_LABELS = {
  local: "Local",
  remote: "Remote",
  merge: "Merge",
  script: "Script",
} as const satisfies Record<NonNullable<IProfileItem["type"]>, string>;

const ENHANCE_TYPE_LABELS = {
  merge: "Merge",
  script: "JS",
} as const;

const StyledChip = styled(Chip, {
  shouldForwardProp: (prop) => prop !== "density",
})<{ density: ProfileTypeChipDensity }>(({ theme, density }) => ({
  height: density === "compact" ? 18 : 20,
  borderRadius: "5px",
  fontSize: density === "compact" ? 10 : 11,
  fontWeight: 700,
  color: theme.palette.primary.main,
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  "& .MuiChip-label": {
    px: density === "compact" ? 0.625 : 0.75,
  },
}));

export const ProfileTypeChip = memo(function ProfileTypeChip({
  type,
  variant = "default",
  density = "default",
}: Props) {
  const label =
    variant === "enhance"
      ? type === "script"
        ? ENHANCE_TYPE_LABELS.script
        : ENHANCE_TYPE_LABELS.merge
      : DEFAULT_TYPE_LABELS[type ?? "local"];

  return <StyledChip density={density} size="small" label={label} />;
});

import { Link, Paper, Tooltip, Typography } from "@mui/material";
import { memo, useMemo, useState } from "react";

import { cn } from "@/utils";

interface Props {
  groupNameList: string[];
  onGroupNameClick?: (groupName: string) => void;
  className?: string;
}

type GroupName = {
  name: string;
  shortName: string;
};

export const ProxyGroupSidebar = memo(function ProxyGroupSidebar(props: Props) {
  const { groupNameList, onGroupNameClick, className } = props;
  const [open, setOpen] = useState(false);
  const groupNameListWithShortName: GroupName[] = useMemo(() => {
    if (groupNameList.length === 0) return [];
    return groupNameList.map((name) => {
      let shortName = name.substring(0, 4);
      const regex = RegExp(/^.*[\u4e00-\u9fa5a-zA-Z0-9\s]+$/);
      if (regex.test(shortName)) {
        shortName = name.substring(0, 2);
        if (regex.test(shortName)) {
          shortName = name.substring(0, 1);
        }
      }
      return { name, shortName };
    });
  }, [groupNameList]);

  return (
    <Paper
      elevation={0}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      className={cn(
        "flex h-full w-full flex-col items-center justify-center text-center text-sm",
        className,
      )}
      sx={(theme) => ({
        boxShadow:
          theme.palette.mode === "light"
            ? "-2px 0 8px rgba(0,0,0,0.08)"
            : "-2px 0 8px rgba(0,0,0,0.3)",
      })}>
      <div className="no-scrollbar hover:scrollbar w-full space-y-2! overflow-auto px-1 py-2">
        {groupNameListWithShortName.map((item) => (
          <Tooltip
            title={item.name}
            key={item.name}
            placement="top"
            followCursor>
            <Link
              underline="none"
              className="hover:bg-primary/15 block cursor-pointer rounded-md px-1 py-1.5 text-center leading-tight transition-[background-color]"
              sx={{
                color: "text.primary",
                "&:hover": { color: "primary.main" },
              }}
              onClick={() => onGroupNameClick && onGroupNameClick(item.name)}>
              <Typography variant="body2">
                {open ? item.name : item.shortName}
              </Typography>
            </Link>
          </Tooltip>
        ))}
      </div>
    </Paper>
  );
});

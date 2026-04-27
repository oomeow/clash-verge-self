import {
  alpha,
  Box,
  ListItem,
  ListItemButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMatchRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";

import { useVergeStore } from "@/stores";
import { cn } from "@/utils";

interface Props {
  to: string;
  children: string;
  icon: React.ReactNode[];
  open: boolean;
  pending?: boolean;
  onNavigate?: () => void;
  onMouseEnter?: () => void;
}
export const LayoutItem = (props: Props) => {
  const {
    to,
    children,
    icon,
    open,
    pending = false,
    onNavigate,
    onMouseEnter,
  } = props;
  const menuIcon = useVergeStore((s) => s.verge.menu_icon ?? "monochrome");
  const matchRoute = useMatchRoute();
  const match = !!matchRoute({ to });
  const navigate = useNavigate();
  const enableMenuIcon = menuIcon && menuIcon !== "disable";

  return (
    <Tooltip
      title={enableMenuIcon && !open ? children : null}
      placement="right">
      <ListItem
        sx={{ py: 0.5, padding: "4px 0px", height: open ? "60px" : "50px" }}>
        <ListItemButton
          selected={match || pending}
          sx={(theme) => {
            const color = theme.palette.primary.main;
            return {
              borderRadius: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: open ? "0 10px" : "0 4px",
              padding: open ? "8px 6px" : "4px",
              "& .MuiListItemText-primary": {
                color: theme.palette.text.primary,
                fontWeight: "700",
              },
              "& .MuiListItemIcon-root": {
                color: theme.palette.text.primary,
              },
              // 涟漪效果颜色
              "& .MuiTouchRipple-root .MuiTouchRipple-rippleVisible": {
                color,
              },
              "&.Mui-selected": { bgcolor: alpha(color, 0.25) },
              ...theme.applyStyles("dark", {
                "&.Mui-selected": { bgcolor: alpha(color, 0.35) },
              }),
              "&.Mui-selected:hover": { bgcolor: alpha(color, 0.25) },
              ...theme.applyStyles("dark", {
                "&.Mui-selected:hover": { bgcolor: alpha(color, 0.35) },
              }),
              "&.Mui-selected .MuiListItemText-primary": { color },
              "&.Mui-selected .MuiListItemIcon-root": { color },
            };
          }}
          onClick={() => {
            onNavigate?.();
            navigate({ to });
          }}
          onMouseEnter={onMouseEnter}>
          <div
            className={cn("flex items-center text-center", { "w-full": open })}>
            <div className="flex h-8 w-full items-center justify-center">
              <motion.div layout className={cn({ "relative left-4": open })}>
                {enableMenuIcon && menuIcon === "monochrome" && (
                  <Box
                    sx={{
                      color: match || pending ? "primary.main" : "text.primary",
                    }}>
                    {icon[0]}
                  </Box>
                )}
                {enableMenuIcon && menuIcon === "colorful" && icon[1]}
              </motion.div>
              {(open || !enableMenuIcon) && (
                <div className="w-full">
                  <Typography
                    sx={{
                      color: match || pending ? "primary.main" : "text.primary",
                      fontWeight: "bold",
                    }}>
                    {children}
                  </Typography>
                </div>
              )}
            </div>
          </div>
        </ListItemButton>
      </ListItem>
    </Tooltip>
  );
};

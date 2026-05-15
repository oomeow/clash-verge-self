import Error from "@mui/icons-material/Error";
import RefreshRounded from "@mui/icons-material/RefreshRounded";
import {
  alpha,
  Button,
  Divider,
  IconButton,
  styled,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { throttle } from "lodash-es";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateRuleProvider } from "tauri-plugin-mihomo-api";

import { BaseDialog } from "@/components/base";
import { useRulesStateStore } from "@/stores";
import { cn } from "@/utils";

export const ProviderButton = () => {
  const { t } = useTranslation();
  const rules = useRulesStateStore((s) => s.rules);
  const fetchRules = useRulesStateStore((s) => s.fetchRules);
  const loadPayload = useRulesStateStore((s) => s.loadPayload);
  const providers = rules.filter(
    (i) => i.vehicleType === "HTTP" || i.vehicleType === "File",
  );

  const names = providers.map((i) => i.payload);
  const hasProvider = names.length > 0;

  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(names.map(() => false));
  const [errorItems, setErrorItems] = useState<string[]>([]);

  const setUpdatingAt = (status: boolean, index: number) => {
    setUpdating((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };

  const handleUpdate = async (name: string, index: number, retryCount = 5) => {
    setUpdatingAt(true, index);
    try {
      await updateRuleProvider(name);
      setErrorItems((prev) => {
        if (prev?.includes(name)) {
          return prev.filter((item) => item !== name);
        }
        return prev;
      });
    } catch (ignore) {
      if (retryCount < 0) {
        setErrorItems((prev) => {
          if (prev?.includes(name)) {
            return prev;
          }
          return [...prev, name];
        });
      } else {
        // retry after 1 second
        setTimeout(async () => {
          await handleUpdate(name, index, retryCount - 1);
        }, 1000);
      }
    } finally {
      setUpdatingAt(false, index);
    }
  };

  const updateAll = throttle(async () => {
    const tasks = names.map((name, index) => handleUpdate(name, index));
    await Promise.all(tasks);
    await fetchRules();
    await loadPayload();
  }, 1000);

  const updateOne = throttle(async (name: string) => {
    await handleUpdate(name, names.indexOf(name));
    await fetchRules();
    await loadPayload();
  }, 1000);

  if (!hasProvider) return null;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        sx={{ textTransform: "capitalize" }}
        onClick={() => setOpen(true)}>
        {t("pages.rules.provider")}
      </Button>

      <BaseDialog
        open={open}
        title={
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center">
              <Typography variant="h6">{t("pages.rules.provider")}</Typography>
              <TypeSpan sx={{ ml: 1, fontSize: 14 }}>
                {providers.length}
              </TypeSpan>
            </div>
            <Button
              variant="contained"
              size="small"
              onClick={async () => await updateAll()}>
              {t("common.actions.updateAll")}
            </Button>
          </div>
        }
        contentStyle={{ width: 400 }}
        hideOkBtn
        hideCancelBtn
        onClose={() => setOpen(false)}>
        <div>
          {providers.map((item, index) => {
            const name = item.payload;
            const time = dayjs(item?.updatedAt);
            const error = errorItems?.includes(name);
            return (
              <div
                key={name}
                className="mb-2 flex items-center rounded-sm bg-white p-2 shadow-sm dark:bg-[#282A36]">
                <div className="w-full overflow-hidden">
                  <div className="flex items-center">
                    {error && (
                      <Error
                        color="error"
                        fontSize="small"
                        sx={{ marginRight: "8px" }}
                      />
                    )}
                    <p className="text-text-primary text-xl">{name}</p>
                    <TypeSpan sx={{ marginLeft: "8px" }}>
                      {item?.ruleCount}
                    </TypeSpan>
                  </div>
                  <StyledTypeSpan>{item?.vehicleType}</StyledTypeSpan>
                  <StyledTypeSpan>{item?.behavior}</StyledTypeSpan>
                  <StyledTypeSpan>
                    {t("pages.proxies.updateAt")} {time.fromNow()}
                  </StyledTypeSpan>
                </div>
                <Divider orientation="vertical" flexItem />
                <IconButton
                  size="small"
                  color="inherit"
                  title={`${t("common.actions.update")}${t("pages.rules.provider")}`}
                  onClick={async () => await updateOne(name)}>
                  <RefreshRounded
                    className={cn({
                      "animate-spin": updating[index],
                    })}
                  />
                </IconButton>
              </div>
            );
          })}
        </div>
      </BaseDialog>
    </>
  );
};

const TypeSpan = styled("span")(({ theme }) => ({
  display: "inline-block",
  backgroundColor: alpha(theme.palette.primary.main, 0.2),
  color: theme.palette.primary.main,
  fontWeight: "bold",
  borderRadius: 4,
  fontSize: 12,
  marginLeft: "8px",
  padding: "0 4px",
}));

const StyledTypeSpan = styled("span")(({ theme }) => ({
  display: "inline-block",
  border: "1px solid #ccc",
  borderColor: alpha(theme.palette.primary.main, 0.5),
  color: alpha(theme.palette.primary.main, 0.8),
  borderRadius: "4px",
  fontSize: "10px",
  marginRight: "4px",
  padding: "0 2px",
}));

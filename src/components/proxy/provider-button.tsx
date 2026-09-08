import RefreshRounded from "@mui/icons-material/RefreshRounded";
import {
  Box,
  Button,
  Divider,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import { throttle } from "lodash-es";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateProxyProvider } from "tauri-plugin-mihomo-api";

import { mutate, swrKeys, useProxyProvidersSWR } from "@/services/swr";
import { cn, getErrorMessage } from "@/utils";
import parseTraffic from "@/utils/parse-traffic";

import { BaseDialog } from "../base";

export const ProviderButton = () => {
  const { t } = useTranslation();
  const { data = {}, mutate: mutateProxyProviders } = useProxyProvidersSWR();
  const entries = Object.entries(data);
  const keys = entries.map(([key]) => key);

  const [open, setOpen] = useState(false);
  const hasProvider = keys.length > 0;
  const [updating, setUpdating] = useState(Object.keys(data).map(() => false));

  const setUpdatingAt = (status: boolean, index: number) => {
    setUpdating((prev) => {
      const next = [...prev];
      next[index] = status;
      return next;
    });
  };
  const handleUpdate = async (key: string, index: number) => {
    try {
      setUpdatingAt(true, index);
      await updateProxyProvider(key);
    } catch (e: unknown) {
      const errmsg = getErrorMessage(e);
      console.error(errmsg);
    } finally {
      setUpdatingAt(false, index);
    }
  };

  const updateAll = throttle(async () => {
    const tasks = keys.map((key, index) => handleUpdate(key, index));
    await Promise.all(tasks);
    mutate(swrKeys.proxies);
    mutateProxyProviders();
  }, 1000);

  const updateOne = throttle(async (key: string) => {
    await handleUpdate(key, keys.indexOf(key));
    mutate(swrKeys.proxies);
    mutateProxyProviders();
  }, 1000);

  if (!hasProvider) return null;

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        sx={{ textTransform: "capitalize" }}
        onClick={() => setOpen(true)}>
        {t("pages.proxies.provider")}
      </Button>
      <BaseDialog
        open={open}
        title={
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              gap: 1,
            }}>
            <Typography variant="h6">{t("pages.proxies.provider")}</Typography>
            <Button
              variant="contained"
              size="small"
              onClick={async () => await updateAll()}>
              {t("common.actions.updateAll")}
            </Button>
          </Box>
        }
        maxWidth="xs"
        fullWidth
        contentStyle={{ backgroundColor: "var(--background-color)" }}
        hideOkBtn
        onClose={() => setOpen(false)}
        onCancel={() => setOpen(false)}>
        <div className="flex flex-col gap-2">
          {Object.entries(data || {}).map(([key, item], index) => {
            const time = dayjs(item?.updatedAt);
            const sub = item?.subscriptionInfo;
            const hasSubInfo = !!sub;
            const upload = sub?.Upload || 0;
            const download = sub?.Download || 0;
            const total = sub?.Total || 0;
            const expire = sub?.Expire || 0;
            const progress = Math.round(
              ((download + upload) * 100) / (total + 0.1),
            );
            return (
              <Paper
                key={key}
                variant="outlined"
                elevation={0}
                className="flex items-center rounded-lg p-2">
                <div className="w-full overflow-hidden pr-4">
                  <div className="flex items-center">
                    <p className="text-text-primary text-xl">{key}</p>
                    <span className="bg-primary/20 text-primary ml-2 inline-block rounded px-1 text-xs font-bold">
                      {item?.proxies.length}
                    </span>
                  </div>
                  <span className="border-primary/50 text-primary/80 mr-1 inline-block rounded border px-1 text-center text-[10px]">
                    {item?.vehicleType}
                  </span>
                  <span className="border-primary/50 text-primary/80 mr-1 inline-block rounded border px-1 text-center text-[10px]">
                    {t("pages.proxies.updateAt")} {time.fromNow()}
                  </span>
                  {hasSubInfo && (
                    <div className="py-1">
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span title="Used / Total">
                          {parseTraffic(upload + download)} /{" "}
                          {parseTraffic(total)}
                        </span>
                        <span title="Expire Time">{parseExpire(expire)}</span>
                      </div>
                      <LinearProgress variant="determinate" value={progress} />
                    </div>
                  )}
                </div>
                <Divider orientation="vertical" flexItem />
                <IconButton
                  size="small"
                  color="inherit"
                  title={`${t("common.actions.update")}${t("pages.proxies.provider")}`}
                  onClick={async () => await updateOne(key)}>
                  <RefreshRounded
                    className={cn({
                      "animate-spin": updating[index],
                    })}
                  />
                </IconButton>
              </Paper>
            );
          })}
        </div>
      </BaseDialog>
    </>
  );
};

function parseExpire(expire?: number) {
  if (!expire) return "-";
  return dayjs(expire * 1000).format("YYYY-MM-DD");
}

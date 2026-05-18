import PauseCircleOutlineRounded from "@mui/icons-material/PauseCircleOutlineRounded";
import PlayCircleOutlineRounded from "@mui/icons-material/PlayCircleOutlineRounded";
import { Button, IconButton, MenuItem, Paper, Stack } from "@mui/material";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Virtuoso } from "react-virtuoso";

import {
  BaseEmpty,
  BasePage,
  BaseSearchBox,
  BaseStyledSelect,
} from "@/components/base";
import LogItem from "@/components/log/log-item";
import { useLogData } from "@/hooks/use-log-data";
import { useClashLogStore } from "@/stores";
import { LogFilter } from "@/stores/clashLogStore";

const LogPage = () => {
  const { t } = useTranslation();
  const {
    response: { data: logData = [] },
    clearClashLog,
  } = useLogData();
  const logEnable = useClashLogStore((s) => s.enable);
  const logState = useClashLogStore((s) => s.logFilter);
  const toggleEnable = useClashLogStore((s) => s.toggleEnable);
  const setLogFilter = useClashLogStore((s) => s.setLogFilter);

  const [match, setMatch] = useState(() => (_: string) => true);
  const filterLogs = useMemo(() => {
    return logData.filter(
      (data) =>
        (logState === "all" ? true : data.type.includes(logState)) &&
        match(data.payload),
    );
  }, [logData, logState, match]);
  return (
    <BasePage
      full
      title={t("pages.logs.title")}
      contentStyle={{ height: "100%" }}
      header={
        <Stack direction="row" className="items-center" spacing={2}>
          <IconButton
            title={t("common.actions.pause")}
            size="small"
            color="inherit"
            onClick={() => toggleEnable()}>
            {logEnable ? (
              <PauseCircleOutlineRounded />
            ) : (
              <PlayCircleOutlineRounded />
            )}
          </IconButton>
          <Button
            size="small"
            variant="contained"
            // useSWRSubscription adds a prefix "$sub$" to the cache key
            // https://github.com/vercel/swr/blob/1585a3e37d90ad0df8097b099db38f1afb43c95d/src/subscription/index.ts#L37
            onClick={() => clearClashLog()}>
            {t("common.actions.clear")}
          </Button>
        </Stack>
      }>
      <Stack
        direction="row"
        spacing={1}
        className="mx-2.5 my-2 box-border h-9 items-center">
        <BaseStyledSelect
          value={logState}
          onChange={(e) => setLogFilter(e.target.value as LogFilter)}>
          <MenuItem value="all">ALL</MenuItem>
          <MenuItem value="inf">INFO</MenuItem>
          <MenuItem value="warn">WARN</MenuItem>
          <MenuItem value="err">ERROR</MenuItem>
        </BaseStyledSelect>
        <BaseSearchBox onSearch={(match) => setMatch(() => match)} />
      </Stack>
      <Paper
        elevation={0}
        className="bg-background-paper mx-2.5 mb-1 box-border h-[calc(100%-50px)] rounded-xl">
        {filterLogs.length > 0 ? (
          <Virtuoso
            initialTopMostItemIndex={999}
            data={filterLogs}
            itemContent={(_index, item) => <LogItem value={item} />}
            followOutput={"smooth"}
          />
        ) : (
          <BaseEmpty text={t("common.empty.noLogs")} />
        )}
      </Paper>
    </BasePage>
  );
};

export default LogPage;

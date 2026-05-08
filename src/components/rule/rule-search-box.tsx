import ArticleRounded from "@mui/icons-material/ArticleRounded";
import ClearRounded from "@mui/icons-material/ClearRounded";
import DnsRounded from "@mui/icons-material/DnsRounded";
import LanguageRounded from "@mui/icons-material/LanguageRounded";
import SearchRounded from "@mui/icons-material/SearchRounded";
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { RuleSearchMode, RuleSearchState } from "@/utils/rule-search";

type Props = {
  onSearch: (state: RuleSearchState) => void;
};

export const RuleSearchBox = ({ onSearch }: Props) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [mode, setMode] = useState<RuleSearchMode>("content");

  const submitSearch = useCallback(
    (nextMode = mode, nextText = text) => {
      onSearch({ mode: nextMode, text: nextText.trim() });
    },
    [mode, onSearch, text],
  );

  return (
    <TextField
      hiddenLabel
      fullWidth
      size="small"
      autoComplete="off"
      variant="outlined"
      spellCheck="false"
      value={text}
      placeholder={
        mode === "content"
          ? t("common.search.contentPlaceholder")
          : mode === "domain"
            ? t("common.search.domainPlaceholder")
            : t("common.search.cidrPlaceholder")
      }
      sx={[
        {
          "& .MuiInputBase-root": {
            pl: 0.5,
            pr: 0.5,
          },
          input: { py: 0.65, px: 1 },
        },
        ({ palette: { mode } }) => {
          return { ...(mode === "light" && { backgroundColor: "#fff" }) };
        },
      ]}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          submitSearch();
        }
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start" sx={{ mr: 0.5 }}>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={mode}
                onChange={(_, value: RuleSearchMode | null) => {
                  if (!value) return;
                  setMode(value);
                  submitSearch(value);
                }}
                sx={{
                  "& .MuiToggleButton-root": {
                    minWidth: 30,
                    height: 26,
                    px: 0.75,
                    py: 0,
                  },
                }}>
                <ToggleButton
                  value="content"
                  aria-label={t("common.search.content")}>
                  <Tooltip title={t("common.search.content")}>
                    <ArticleRounded fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton
                  value="domain"
                  aria-label={t("common.search.domain")}>
                  <Tooltip title={t("common.search.domain")}>
                    <LanguageRounded fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="cidr" aria-label={t("common.search.cidr")}>
                  <Tooltip title={t("common.search.cidr")}>
                    <DnsRounded fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </InputAdornment>
          ),
          endAdornment: (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {text !== "" && (
                <Tooltip title={t("common.actions.clear")}>
                  <IconButton
                    size="small"
                    color="primary"
                    sx={{ p: 0.5 }}
                    onClick={() => {
                      setText("");
                      submitSearch(mode, "");
                    }}>
                    <ClearRounded fontSize="inherit" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={t("common.search.filter")}>
                <IconButton
                  size="small"
                  color="primary"
                  sx={{ p: 0.5 }}
                  onClick={() => submitSearch()}>
                  <SearchRounded fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>
          ),
        },
      }}
    />
  );
};

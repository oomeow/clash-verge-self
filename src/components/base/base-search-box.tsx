import matchCaseIcon from "@/assets/image/component/match_case.svg?react";
import matchWholeWordIcon from "@/assets/image/component/match_whole_word.svg?react";
import useRegularExpressionIcon from "@/assets/image/component/use_regular_expression.svg?react";
import ClearRounded from "@mui/icons-material/ClearRounded";
import { Box, IconButton, SvgIcon, TextField, Tooltip } from "@mui/material";
import { useDebounce, useMemoizedFn } from "ahooks";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

type SearchState = {
  text: string;
  matchCase: boolean;
  matchWholeWord: boolean;
  useRegularExpression: boolean;
};

type SearchProps = {
  placeholder?: string;
  onSearch: (match: (content: string) => boolean, state: SearchState) => void;
};

const DEFAULT_SEARCH_OPTIONS = {
  matchCase: true,
  matchWholeWord: false,
  useRegularExpression: false,
};

const EMPTY_MATCHER = (content: string) => content.includes("");

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const createMatcher = (state: SearchState) => {
  const { text, matchCase, matchWholeWord, useRegularExpression } = state;

  if (!text) {
    return EMPTY_MATCHER;
  }

  if (useRegularExpression || matchWholeWord) {
    const pattern = useRegularExpression ? text : escapeRegExp(text);
    const source = matchWholeWord ? `\\b(?:${pattern})\\b` : pattern;
    const flags = matchCase ? "" : "i";
    const regex = new RegExp(source, flags);

    return (content: string) => regex.test(content);
  }

  if (matchCase) {
    return (content: string) => content.includes(text);
  }

  const normalizedText = text.toLowerCase();
  return (content: string) => content.toLowerCase().includes(normalizedText);
};

export const BaseSearchBox = (props: SearchProps) => {
  const { placeholder, onSearch } = props;
  const { t } = useTranslation();
  const [filterText, setFilterText] = useState("");
  const debounceFilterText = useDebounce(filterText, { wait: 500 });
  const [searchOptions, setSearchOptions] = useState(DEFAULT_SEARCH_OPTIONS);
  const [errorMessage, setErrorMessage] = useState("");

  const iconStyle = {
    style: {
      height: "24px",
      width: "24px",
      cursor: "pointer",
    } as CSSProperties,
    inheritViewBox: true,
  };
  const emitSearch = useMemoizedFn(onSearch);

  const searchState = useMemo(
    () => ({
      text: debounceFilterText,
      ...searchOptions,
    }),
    [debounceFilterText, searchOptions],
  );

  useEffect(() => {
    try {
      const matcher = createMatcher(searchState);
      setErrorMessage((prev) => (prev ? "" : prev));
      emitSearch(matcher, searchState);
    } catch (err) {
      const nextError = `${err}`;
      setErrorMessage((prev) => (prev === nextError ? prev : nextError));
      emitSearch(() => false, searchState);
    }
  }, [emitSearch, searchState]);

  return (
    <Tooltip title={errorMessage} placement="bottom-start">
      <TextField
        hiddenLabel
        fullWidth
        size="small"
        autoComplete="off"
        variant="outlined"
        spellCheck="false"
        value={filterText}
        placeholder={placeholder ?? t("Filter conditions")}
        sx={[
          { input: { py: 0.65, px: 1.25 } },
          ({ palette: { mode } }) => {
            return { ...(mode === "light" && { backgroundColor: "#fff" }) };
          },
        ]}
        onChange={(e) => {
          setFilterText(() => e.target.value);
        }}
        slotProps={{
          input: {
            endAdornment: (
              <Box display="flex">
                {filterText !== "" && (
                  <Tooltip title={t("Clear")}>
                    <IconButton
                      size="small"
                      color="primary"
                      sx={{ p: 0.5 }}
                      onClick={() => setFilterText("")}>
                      <ClearRounded fontSize="inherit" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title={t("Match Case")}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.5 }}
                    color={searchOptions.matchCase ? "primary" : "default"}
                    onClick={() => {
                      setSearchOptions((pre) => ({
                        ...pre,
                        matchCase: !pre.matchCase,
                      }));
                    }}>
                    <SvgIcon
                      fontSize="inherit"
                      component={matchCaseIcon}
                      {...iconStyle}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("Match Whole Word")}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.5 }}
                    color={searchOptions.matchWholeWord ? "primary" : "default"}
                    onClick={() => {
                      setSearchOptions((pre) => ({
                        ...pre,
                        matchWholeWord: !pre.matchWholeWord,
                      }));
                    }}>
                    <SvgIcon
                      fontSize="inherit"
                      component={matchWholeWordIcon}
                      {...iconStyle}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title={t("Use Regular Expression")}>
                  <IconButton
                    size="small"
                    sx={{ p: 0.5 }}
                    color={
                      searchOptions.useRegularExpression ? "primary" : "default"
                    }
                    onClick={() => {
                      setSearchOptions((pre) => ({
                        ...pre,
                        useRegularExpression: !pre.useRegularExpression,
                      }));
                    }}>
                    <SvgIcon
                      fontSize="inherit"
                      component={useRegularExpressionIcon}
                      {...iconStyle}
                    />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          },
        }}
      />
    </Tooltip>
  );
};

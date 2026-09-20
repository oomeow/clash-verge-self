import type { MihomoVersion } from "@/services/cmds";

export type MihomoSlot = "self-mihomo" | "self-mihomo-alpha";

// 版本所属槽位：alpha/nightly 归 alpha 槽，其余（stable）归 stable 槽。
export const slotOf = (version: MihomoVersion): MihomoSlot =>
  version.channel === "alpha" || version.channel === "nightly"
    ? "self-mihomo-alpha"
    : "self-mihomo";

// 槽位对应的频道（self-mihomo → stable，self-mihomo-alpha → alpha）。
export const slotChannel = (slot: MihomoSlot): "alpha" | "stable" =>
  slot === "self-mihomo-alpha" ? "alpha" : "stable";

// 该版本条目是否匹配已装版本号。
// tag/semver 精确匹配（忽略可选的 v 前缀），稳定版号必须精确比对，
// substring 会把 v1.19.2 误匹配到 v1.19.29；alpha 槽位只报短哈希
// （如 alpha-8d71008），tag 对不上，额外比对资产名内嵌的同一哈希。
export const matchesInstalled = (
  version: MihomoVersion,
  installed?: string,
): boolean => {
  if (!installed) return false;
  // 已装版本号可能带 v 前缀，tag/semver 需同时比对两种形式。
  const stripped = installed.replace(/^v/i, "");
  return (
    version.tag === installed ||
    version.tag === stripped ||
    version.semver === installed ||
    version.semver === stripped ||
    (installed.startsWith("alpha-") &&
      version.assets.some((a) => a.name.includes(installed)))
  );
};

// alpha 槽位已装版本落后于索引：当前已装版本号在 alpha 频道里找不到匹配项。
export const isActiveVersionMismatch = (
  clashCore: MihomoSlot,
  activeVersion: string | undefined,
  versions?: MihomoVersion[],
): boolean =>
  clashCore === "self-mihomo-alpha" &&
  !!activeVersion &&
  !(versions ?? []).some(
    (v) => v.channel === "alpha" && matchesInstalled(v, activeVersion),
  );

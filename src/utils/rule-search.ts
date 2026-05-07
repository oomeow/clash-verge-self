type SearchableRule = {
  type: string;
  behavior?: string;
};

type IpRange = {
  version: 4 | 6;
  start: bigint;
  end: bigint;
};

export type RuleSearchMode = "domain" | "cidr";

export type RuleSearchState = {
  mode: RuleSearchMode;
  text: string;
};

export const EMPTY_RULE_SEARCH: RuleSearchState = {
  mode: "domain",
  text: "",
};

const DOMAIN_RULE_TYPES = new Set([
  "DOMAIN",
  "DOMAIN-SUFFIX",
  "DOMAIN-KEYWORD",
  "DOMAIN-REGEX",
  "DOMAIN-WILDCARD",
  "GEOSITE",
]);

const CIDR_RULE_TYPES = new Set(["IP-CIDR", "IP-CIDR6", "SRC-IP-CIDR"]);

const normalizeRuleType = (type: string) => {
  const ruleTypeMap: Record<string, string> = {
    Domain: "DOMAIN",
    DomainSuffix: "DOMAIN-SUFFIX",
    DomainKeyword: "DOMAIN-KEYWORD",
    DomainRegex: "DOMAIN-REGEX",
    DomainWildcard: "DOMAIN-WILDCARD",
    GeoSite: "GEOSITE",
    IPCIDR: "IP-CIDR",
    SrcIPCIDR: "SRC-IP-CIDR",
  };

  return ruleTypeMap[type] ?? type.toUpperCase();
};

const splitRuleParts = (payload: string) =>
  payload
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const getExplicitRulePayload = (payload: string, ruleTypes: Set<string>) => {
  const parts = splitRuleParts(payload);
  const explicitType = parts[0] ? normalizeRuleType(parts[0]) : undefined;

  if (!explicitType || !ruleTypes.has(explicitType)) {
    return null;
  }

  const source = parts[1] ?? "";
  if (!source) return null;

  return { type: explicitType, source };
};

export const normalizeDomain = (value: string) => {
  const trimmed = value.trim().toLowerCase();
  const rawHost = (() => {
    try {
      return new URL(trimmed).hostname;
    } catch {
      const withoutScheme = trimmed.replace(/^[a-z][a-z\d+.-]*:\/\//, "");
      return withoutScheme.split(/[/?#]/)[0] ?? "";
    }
  })();
  const withoutPort = rawHost.replace(/:\d+$/, "");

  return withoutPort
    .replace(/^\*\./, "")
    .replace(/^\+\./, "")
    .replace(/^www\d*\./, "")
    .replace(/^\./, "")
    .replace(/\.$/, "");
};

const getDomainSearchPayload = (rule: SearchableRule, payload: string) => {
  if (!payload) return null;
  const explicitPayload = getExplicitRulePayload(payload, DOMAIN_RULE_TYPES);

  if (explicitPayload) {
    return {
      type: explicitPayload.type,
      value: normalizeDomain(explicitPayload.source),
    };
  }

  if (rule.behavior && rule.behavior.toLowerCase() !== "domain") {
    return null;
  }

  const ruleType = normalizeRuleType(rule.type);
  if (!rule.behavior && !DOMAIN_RULE_TYPES.has(ruleType)) {
    return null;
  }

  return {
    type: ruleType,
    value: normalizeDomain(payload),
  };
};

const domainMatches = (
  rule: SearchableRule,
  payload: string,
  normalizedQuery: string,
) => {
  if (!normalizedQuery) return true;

  const searchPayload = getDomainSearchPayload(rule, payload);
  if (!searchPayload?.value) return false;

  const { type, value } = searchPayload;

  if (type === "DOMAIN-KEYWORD") {
    return normalizedQuery.includes(value) || value.includes(normalizedQuery);
  }

  if (!normalizedQuery.includes(".")) {
    return value.includes(normalizedQuery);
  }

  if (type === "DOMAIN") {
    return value === normalizedQuery;
  }

  return (
    value === normalizedQuery ||
    normalizedQuery.endsWith(`.${value}`) ||
    value.endsWith(`.${normalizedQuery}`)
  );
};

const parseIpv4 = (value: string) => {
  const parts = value.split(".");
  if (parts.length !== 4) return null;

  return parts.reduce<bigint | null>((acc, part) => {
    if (acc === null || !/^\d+$/.test(part)) return null;
    const byte = Number(part);
    if (byte < 0 || byte > 255) return null;
    return (acc << BigInt(8)) + BigInt(byte);
  }, BigInt(0));
};

const parseIpv6 = (value: string) => {
  const scopedValue = value
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0];
  if (!scopedValue || scopedValue.split("::").length > 2) return null;

  let normalizedValue = scopedValue;
  if (normalizedValue.includes(".")) {
    const lastColonIndex = normalizedValue.lastIndexOf(":");
    const ipv4 = parseIpv4(normalizedValue.slice(lastColonIndex + 1));
    if (ipv4 === null) return null;

    const high = Number((ipv4 >> BigInt(16)) & BigInt(0xffff)).toString(16);
    const low = Number(ipv4 & BigInt(0xffff)).toString(16);
    normalizedValue = `${normalizedValue.slice(0, lastColonIndex)}:${high}:${low}`;
  }

  const [left = "", right = ""] = normalizedValue.split("::");
  const leftParts = left ? left.split(":") : [];
  const rightParts = right ? right.split(":") : [];
  const fillCount = 8 - leftParts.length - rightParts.length;
  if (fillCount < 0 || (!normalizedValue.includes("::") && fillCount !== 0)) {
    return null;
  }

  const parts = [
    ...leftParts,
    ...Array<string>(fillCount).fill("0"),
    ...rightParts,
  ];

  return parts.reduce<bigint | null>((acc, part) => {
    if (acc === null || !/^[\da-f]{1,4}$/.test(part)) return null;
    return (acc << BigInt(16)) + BigInt(parseInt(part, 16));
  }, BigInt(0));
};

const parseIpValue = (value: string) => {
  if (value.includes(":")) {
    const parsed = parseIpv6(value);
    return parsed === null ? null : { version: 6 as const, value: parsed };
  }

  const parsed = parseIpv4(value);
  return parsed === null ? null : { version: 4 as const, value: parsed };
};

const parseCidrRange = (value: string): IpRange | null => {
  const [address = "", prefixText] = value.trim().split("/");
  const parsedIp = parseIpValue(address);
  if (!parsedIp) return null;

  const bitSize = parsedIp.version === 4 ? 32 : 128;
  const prefix = prefixText === undefined ? bitSize : Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > bitSize) return null;

  const hostBits = BigInt(bitSize - prefix);
  const blockSize = BigInt(1) << hostBits;
  const start = (parsedIp.value >> hostBits) << hostBits;

  return {
    version: parsedIp.version,
    start,
    end: start + blockSize - BigInt(1),
  };
};

const rangesOverlap = (left: IpRange, right: IpRange) =>
  left.version === right.version &&
  left.start <= right.end &&
  right.start <= left.end;

const getCidrSearchPayload = (rule: SearchableRule, payload: string) => {
  const explicitPayload = getExplicitRulePayload(payload, CIDR_RULE_TYPES);
  if (explicitPayload) {
    return explicitPayload.source;
  }

  if (!payload) return null;
  if (rule.behavior && rule.behavior.toLowerCase() !== "ipcidr") {
    return null;
  }

  const ruleType = normalizeRuleType(rule.type);
  if (!rule.behavior && !CIDR_RULE_TYPES.has(ruleType)) {
    return null;
  }

  return payload;
};

const cidrMatches = (
  rule: SearchableRule,
  payload: string,
  normalizedQuery: string,
  queryRange: IpRange | null,
) => {
  if (!normalizedQuery) return true;
  const cidrPayload = getCidrSearchPayload(rule, payload);
  if (!cidrPayload) return false;

  const payloadRange = parseCidrRange(cidrPayload);
  if (!queryRange || !payloadRange) {
    return cidrPayload.toLowerCase().includes(normalizedQuery);
  }

  return rangesOverlap(queryRange, payloadRange);
};

export const createRuleSearchMatcher = (search: RuleSearchState) => {
  if (!search.text) return () => true;

  if (search.mode === "domain") {
    const normalizedQuery = normalizeDomain(search.text);
    return (rule: SearchableRule, payload: string) =>
      domainMatches(rule, payload, normalizedQuery);
  }

  const normalizedQuery = search.text.trim().toLowerCase();
  const queryRange = parseCidrRange(normalizedQuery);
  return (rule: SearchableRule, payload: string) =>
    cidrMatches(rule, payload, normalizedQuery, queryRange);
};

export const ruleMatchesSearch = (
  rule: SearchableRule,
  payload: string,
  search: RuleSearchState,
) => {
  return createRuleSearchMatcher(search)(rule, payload);
};

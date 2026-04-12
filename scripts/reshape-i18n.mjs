import fs from "node:fs";
import path from "node:path";

const localeDir = path.resolve("src/locales");
const localeNames = ["zh", "en", "ru", "fa"];

const preferredKeys = {
  Back: "common.actions.back",
  Close: "common.actions.close",
  Cancel: "common.actions.cancel",
  Confirm: "common.actions.confirm",
  Auto: "common.actions.auto",
  New: "common.actions.new",
  Edit: "common.actions.edit",
  Save: "common.actions.save",
  Delete: "common.actions.delete",
  Enable: "common.actions.enable",
  Disable: "common.actions.disable",
  Add: "common.actions.add",
  Apply: "common.actions.apply",
  Browse: "common.actions.browse",
  Clear: "common.actions.clear",
  Pause: "common.actions.pause",
  Refresh: "common.actions.refresh",
  Import: "common.actions.import",
  Update: "common.actions.update",
  "Update All": "common.actions.updateAll",
  Upgrade: "common.actions.upgrade",
  Restart: "common.actions.restart",
  Install: "common.actions.install",
  Uninstall: "common.actions.uninstall",
  Grant: "common.actions.grant",
  "Re-Grant": "common.actions.reGrant",
  Select: "common.actions.select",
  "Open URL": "common.actions.openUrl",
  "Choose File": "common.actions.chooseFile",
  "Reset to Default": "common.actions.resetToDefault",
  "Expand All": "common.actions.expandAll",
  "Collapse All": "common.actions.collapseAll",
  Exit: "common.actions.exit",
  Active: "common.status.active",
  Closed: "common.status.closed",
  Default: "common.status.default",
  pending: "common.status.service.pending",
  installed: "common.status.service.installed",
  uninstall: "common.status.service.uninstall",
  active: "common.status.service.active",
  unknown: "common.status.service.unknown",
  Enabled: "common.status.enabled",
  Disabled: "common.status.disabled",
  Granted: "common.status.granted",
  "Not Granted": "common.status.notGranted",
  ReadOnly: "common.status.readOnly",
  "Not available": "common.status.notAvailable",
  Recommended: "common.status.recommended",
  Required: "common.status.required",
  Name: "common.fields.name",
  Type: "common.fields.type",
  Descriptions: "common.fields.description",
  Icon: "common.fields.icon",
  Location: "common.fields.location",
  Host: "common.fields.host",
  Process: "common.fields.process",
  Time: "common.fields.time",
  Source: "common.fields.source",
  Destination: "common.fields.destination",
  From: "common.fields.from",
  "Updated Time": "common.fields.updatedTime",
  "Expire Time": "common.fields.expireTime",
  "Used / Total": "common.fields.usedTotal",
  Device: "common.fields.device",
  Stack: "common.fields.stack",
  Language: "common.fields.language",
  "Start Page": "common.fields.startPage",
  "Startup Script": "common.fields.startupScript",
  Filter: "common.search.filter",
  "Filter conditions": "common.search.filterConditions",
  "Match Case": "common.search.matchCase",
  "Match Whole Word": "common.search.matchWholeWord",
  "Use Regular Expression": "common.search.useRegularExpression",
  "No Connections": "common.empty.noConnections",
  "No Logs": "common.empty.noLogs",
  "No Rules": "common.empty.noRules",
  "No Proxies": "common.empty.noProxies",
  "Direct Mode": "common.empty.directMode",
  "Label-Proxies": "navigation.sidebar.proxies",
  "Label-Profiles": "navigation.sidebar.profiles",
  "Label-Connections": "navigation.sidebar.connections",
  "Label-Rules": "navigation.sidebar.rules",
  "Label-Logs": "navigation.sidebar.logs",
  "Label-Test": "navigation.sidebar.test",
  "Label-Settings": "navigation.sidebar.settings",
  Proxies: "pages.proxies.title",
  "Proxy Groups": "pages.proxies.groups",
  "Proxy Provider": "pages.proxies.provider",
  "Update At": "pages.proxies.updateAt",
  rule: "pages.proxies.modes.rule",
  global: "pages.proxies.modes.global",
  direct: "pages.proxies.modes.direct",
  script: "pages.proxies.modes.script",
  merge: "pages.proxies.modes.merge",
  remote: "pages.proxies.modes.remote",
  local: "pages.proxies.modes.local",
  "Delay check": "pages.proxies.actions.delayCheck",
  "Delay check URL": "pages.proxies.actions.delayCheckUrl",
  "Sort by default": "pages.proxies.sort.default",
  "Sort by delay": "pages.proxies.sort.delay",
  "Sort by name": "pages.proxies.sort.name",
  "Proxy basic": "pages.proxies.view.basic",
  "Proxy detail": "pages.proxies.view.detail",
  Profiles: "pages.profiles.title",
  "Enhance Scripts": "pages.profiles.actions.enhanceScripts",
  "Update Profile": "pages.profiles.actions.updateProfile",
  "Update All Profiles": "pages.profiles.actions.updateAllProfiles",
  "View Runtime Config": "pages.profiles.actions.viewRuntimeConfig",
  "Reactivate Profiles": "pages.profiles.actions.reactivateProfiles",
  Paste: "pages.profiles.actions.paste",
  "Profile URL": "pages.profiles.inputs.profileUrl",
  "Create Profile": "pages.profiles.dialog.createTitle",
  "Edit Profile": "pages.profiles.dialog.editTitle",
  "Subscription URL": "pages.profiles.fields.subscriptionUrl",
  "Update Interval": "pages.profiles.fields.updateInterval",
  "Use System Proxy": "pages.profiles.fields.useSystemProxy",
  "Use Clash Proxy": "pages.profiles.fields.useClashProxy",
  "Accept Invalid Certs (Danger)":
    "pages.profiles.fields.acceptInvalidCertsDanger",
  "Edit File": "pages.profiles.actions.editFile",
  "Open File": "pages.profiles.actions.openFile",
  "Update(Proxy)": "pages.profiles.actions.updateProxy",
  "Confirm deletion": "pages.profiles.dialog.confirmDeletion",
  "This operation is not reversible":
    "pages.profiles.dialog.confirmDeletionMessage",
  "Script Console": "pages.profiles.runtime.scriptConsole",
  "To Top": "pages.profiles.actions.toTop",
  "To End": "pages.profiles.actions.toEnd",
  Connections: "pages.connections.title",
  "Table View": "pages.connections.view.table",
  "List View": "pages.connections.view.list",
  "Close All": "pages.connections.actions.closeAll",
  "Close Connection": "pages.connections.actions.closeConnection",
  Actions: "pages.connections.columns.actions",
  ClosedTime: "pages.connections.columns.closedTime",
  "Download Speed": "pages.connections.columns.downloadSpeed",
  "Upload Speed": "pages.connections.columns.uploadSpeed",
  "Total Downloaded": "pages.connections.columns.totalDownloaded",
  "Total Uploaded": "pages.connections.columns.totalUploaded",
  Downloaded: "pages.connections.columns.downloaded",
  Uploaded: "pages.connections.columns.uploaded",
  "DL Speed": "pages.connections.columns.dlSpeed",
  "UL Speed": "pages.connections.columns.ulSpeed",
  Chains: "pages.connections.columns.chains",
  Rule: "pages.connections.columns.rule",
  "Start At": "pages.connections.columns.startAt",
  Rules: "pages.rules.title",
  "Rule Provider": "pages.rules.provider",
  Logs: "pages.logs.title",
  Test: "pages.test.title",
  "Test All": "pages.test.actions.testAll",
  "Create Test": "pages.test.dialog.createTitle",
  "Edit Test": "pages.test.dialog.editTitle",
  "Test URL": "pages.test.fields.url",
  Settings: "pages.settings.title",
  "System Setting": "settings.system.title",
  "System Proxy": "settings.system.proxy.label",
  "System Proxy Info": "settings.system.proxy.info",
  "System Proxy Setting": "settings.system.proxy.dialogTitle",
  "Current System Proxy": "settings.system.proxy.current",
  "Enable status": "settings.system.proxy.enableStatus",
  "Server Addr": "settings.system.proxy.serverAddr",
  Bypass: "settings.system.proxy.bypassValue",
  "Proxy Guard": "settings.system.proxy.guard.label",
  "Proxy Guard Info": "settings.system.proxy.guard.info",
  "Guard Duration": "settings.system.proxy.guard.duration",
  "Proxy Bypass": "settings.system.proxy.bypass.label",
  "Use PAC Mode": "settings.system.proxy.pac.useMode",
  "PAC Script Content": "settings.system.proxy.pac.content",
  "PAC URL": "settings.system.proxy.pac.url",
  "Auto Launch": "settings.system.autoLaunch",
  "Silent Start": "settings.system.silentStart.label",
  "silent.bootup": "settings.system.silentStart.options.bootup",
  "silent.global": "settings.system.silentStart.options.global",
  "silent.off": "settings.system.silentStart.options.off",
  "Clash Setting": "settings.clash.title",
  "Tun Mode": "settings.clash.tun.label",
  "Tun Mode Info": "settings.clash.tun.info",
  "System and Mixed Can Only be Used in Service Mode":
    "settings.clash.tun.serviceModeOnly",
  "Auto Route": "settings.clash.tun.autoRoute",
  "Strict Route": "settings.clash.tun.strictRoute",
  "Auto Detect Interface": "settings.clash.tun.autoDetectInterface",
  "DNS Hijack": "settings.clash.tun.dnsHijack",
  MTU: "settings.clash.tun.mtu",
  "Service Mode": "settings.clash.serviceMode.label",
  "Current State": "settings.clash.serviceMode.currentState",
  "Information: Please make sure that the Clash Verge Service is installed and enabled":
    "settings.clash.serviceMode.info",
  "Disable Service Mode": "settings.clash.serviceMode.disable",
  "Allow Lan": "settings.clash.allowLan",
  "Network Interface Info": "settings.clash.networkInterfaceInfo",
  IPv6: "settings.clash.ipv6",
  "Find Process Mode": "settings.clash.findProcessMode.label",
  "Find Process Mode Always": "settings.clash.findProcessMode.options.always",
  "Find Process Mode Strict": "settings.clash.findProcessMode.options.strict",
  "Find Process Mode Off": "settings.clash.findProcessMode.options.off",
  "Log Level": "settings.clash.logLevel",
  "Port Config": "settings.clash.portConfig.label",
  "Random Port": "settings.clash.portConfig.randomPort",
  "Clash Port": "settings.clash.portConfig.dialogTitle",
  "External Controller": "settings.clash.externalController.label",
  "External Controller Host": "settings.clash.externalController.host",
  "External Controller Secret": "settings.clash.externalController.secret",
  "External Controller Enabled": "settings.clash.externalController.enabled",
  "External Controller Disabled": "settings.clash.externalController.disabled",
  "Allow Private Network":
    "settings.clash.externalController.allowPrivateNetwork",
  "Allow Origins": "settings.clash.externalController.allowOrigins",
  "Duplicate Allow Origins":
    "settings.clash.externalController.duplicateAllowOrigins",
  "Reset Default Allow Origins":
    "settings.clash.externalController.resetDefaultAllowOrigins",
  "Web UI": "settings.clash.webUi",
  "Clash Core": "settings.clash.core.label",
  "Update core requires": "settings.clash.core.updateRequires",
  "Open UWP tool": "settings.clash.openUwpTool",
  "Update GeoData": "settings.clash.updateGeoData",
  "Unified Delay": "settings.clash.unifiedDelay.label",
  "Unified Delay Info": "settings.clash.unifiedDelay.info",
  "Flush Cache": "settings.clash.flushCache",
  "Cache Flushed": "settings.clash.cacheFlushed",
  "Verge Setting": "settings.verge.title",
  "Theme Mode": "settings.verge.themeMode.label",
  "theme.light": "settings.verge.themeMode.options.light",
  "theme.dark": "settings.verge.themeMode.options.dark",
  "theme.system": "settings.verge.themeMode.options.system",
  "Tray Click Event": "settings.verge.tray.clickEvent",
  "Show Main Window": "settings.verge.tray.showMainWindow",
  "Copy Env Type": "settings.verge.env.copyType",
  "Copy Env Successfully": "settings.verge.env.copySuccess",
  "Theme Setting": "settings.verge.theme.title",
  "Default Color": "settings.verge.theme.colors.default",
  "Primary Color": "settings.verge.theme.colors.primary",
  "Secondary Color": "settings.verge.theme.colors.secondary",
  "Primary Text": "settings.verge.theme.colors.primaryText",
  "Secondary Text": "settings.verge.theme.colors.secondaryText",
  "Info Color": "settings.verge.theme.colors.info",
  "Warning Color": "settings.verge.theme.colors.warning",
  "Error Color": "settings.verge.theme.colors.error",
  "Success Color": "settings.verge.theme.colors.success",
  "Font Family": "settings.verge.theme.fontFamily",
  "CSS Injection": "settings.verge.theme.cssInjection",
  "Layout Setting": "settings.verge.layout.title",
  "Traffic Graph": "settings.verge.layout.trafficGraph",
  "Memory Usage": "settings.verge.layout.memoryUsage",
  "Proxy Group Icon": "settings.verge.layout.proxyGroupIcon",
  "Menu Icon": "settings.verge.layout.menuIcon",
  Monochrome: "settings.verge.layout.icon.monochrome",
  Colorful: "settings.verge.layout.icon.colorful",
  Tray: "settings.verge.layout.tray.label",
  "Tray Icon": "settings.verge.layout.tray.icon",
  "Common Tray Icon": "settings.verge.layout.tray.common",
  "System Proxy Tray Icon": "settings.verge.layout.tray.systemProxy",
  "Tun Tray Icon": "settings.verge.layout.tray.tun",
  Miscellaneous: "settings.verge.misc.title",
  "App Log Level": "settings.verge.misc.appLogLevel",
  "Auto Close Connections": "settings.verge.misc.autoCloseConnections",
  "Auto Check Update": "settings.verge.misc.autoCheckUpdate",
  "Enable Builtin Enhanced": "settings.verge.misc.enableBuiltinEnhanced",
  "Proxy Layout Column": "settings.verge.misc.proxyLayoutColumn",
  "Auto Log Clean": "settings.verge.misc.autoLogClean.label",
  "Never Clean": "settings.verge.misc.autoLogClean.options.never",
  "Retain 7 Days": "settings.verge.misc.autoLogClean.options.sevenDays",
  "Retain 30 Days": "settings.verge.misc.autoLogClean.options.thirtyDays",
  "Retain 90 Days": "settings.verge.misc.autoLogClean.options.ninetyDays",
  "Default Latency Test": "settings.verge.misc.defaultLatencyTest",
  "Default Latency Timeout": "settings.verge.misc.defaultLatencyTimeout",
  "Hotkey Setting": "settings.verge.hotkeys.title",
  open_or_close_dashboard:
    "settings.verge.hotkeys.actions.openOrCloseDashboard",
  clash_mode_rule: "settings.verge.hotkeys.actions.ruleMode",
  clash_mode_global: "settings.verge.hotkeys.actions.globalMode",
  clash_mode_direct: "settings.verge.hotkeys.actions.directMode",
  toggle_system_proxy: "settings.verge.hotkeys.actions.toggleSystemProxy",
  toggle_tun_mode: "settings.verge.hotkeys.actions.toggleTunMode",
  "Runtime Config": "settings.verge.runtimeConfig",
  "Open App Dir": "settings.verge.actions.openAppDir",
  "Open Core Dir": "settings.verge.actions.openCoreDir",
  "Open Logs Dir": "settings.verge.actions.openLogsDir",
  "Check for Updates": "settings.verge.actions.checkForUpdates",
  "Go to Release Page": "settings.verge.actions.goToReleasePage",
  "Open Dev Tools": "settings.verge.actions.openDevTools",
  "Verge Version": "settings.verge.version",
  Splashscreen: "settings.verge.layout.splashscreen",
  "System Title Bar": "settings.verge.layout.systemTitleBar",
  "Keep In Dock": "settings.verge.layout.keepInDock.label",
  "Keep In Dock Info": "settings.verge.layout.keepInDock.info",
  "Keep UI Active": "settings.verge.layout.keepUiActive.label",
  "Keep UI Active Info": "settings.verge.layout.keepUiActive.info",
  ReadOnlyMessage: "messages.editor.readOnly",
  "Regenerate Template Content": "messages.editor.regenerateTemplateContent",
  "Profile Imported Successfully": "messages.profiles.imported",
  "Clash Config Updated": "messages.clash.configUpdated",
  "Profile Switched": "messages.profiles.switched",
  "Profile Reactivated": "messages.profiles.reactivated",
  "Only YAML Files Supported": "messages.profiles.onlyYamlSupported",
  "Settings Applied": "messages.settings.applied",
  "Service Installed Successfully": "messages.settings.serviceInstalled",
  "Service Uninstalled Successfully": "messages.settings.serviceUninstalled",
  "Proxy Daemon Duration Cannot be Less than 1 Second":
    "messages.settings.proxyGuardDurationTooShort",
  "Invalid Bypass Format": "messages.settings.invalidBypassFormat",
  "Clash Port Modified": "messages.clash.portModified",
  "Port Conflict": "messages.clash.portConflict",
  "Restart Application to Apply Modifications": "messages.app.restartToApply",
  "External Controller Address Modified":
    "messages.clash.externalControllerAddressModified",
  "Permissions Granted Successfully for _clash Core":
    "messages.clash.core.permissionsGranted",
  "Please grant permissions for _clash Core":
    "messages.clash.core.requireGrant",
  "Core Version Updated": "messages.clash.core.versionUpdated",
  "Clash Core Restarted": "messages.clash.core.restarted",
  "Switched to _clash Core": "messages.clash.core.switched",
  "GeoData Updated": "messages.clash.geoDataUpdated",
  "Currently on the Latest Version": "messages.app.latestVersion",
  "Update Rule Provider Error": "messages.rules.updateProviderError",
  "Read Rule Providers Error": "messages.rules.readProvidersError",
  "Macos Tun Device Name Error": "messages.clash.tun.macosDeviceNameError",
  "Tun Device Or Resource Busy": "messages.clash.tun.deviceBusy",
  "Update Tun Config Failed": "messages.clash.tun.updateConfigFailed",
  "Script Run Check Failed": "messages.profiles.scriptRunCheckFailed",
  "Script Run Check Successful": "messages.profiles.scriptRunCheckSuccessful",
  "Save Content Successfully": "messages.profiles.contentSaved",
  "Profile Content No Change": "messages.profiles.contentUnchanged",
  "Profile Config No Change": "messages.profiles.configUnchanged",
  "Profile Config Updated": "messages.profiles.configUpdated",
  "Save Content Failed": "messages.profiles.contentSaveFailed",
  "Save Content": "messages.profiles.saveContent",
  "Ask Save Content Now": "messages.profiles.askSaveContentNow",
  "Portable Updater Error": "messages.updater.portableError",
  "Break Change Update Error": "messages.updater.breakingChangeError",
  "Backup Setting": "settings.verge.backup.title",
  BK_Local: "settings.verge.backup.types.local",
  BK_WebDAV: "settings.verge.backup.types.webdav",
  "Invalid file format": "settings.verge.backup.invalidFileFormat",
  "WebDav Backup": "settings.verge.backup.webdavTitle",
  Recovery: "settings.verge.backup.actions.recovery",
  Backup: "settings.verge.backup.actions.backup",
  "Only Backup Profiles": "settings.verge.backup.onlyProfiles",
  "WebDav URL": "settings.verge.backup.webdav.url",
  "WebDav Username": "settings.verge.backup.webdav.username",
  "WebDav Password": "settings.verge.backup.webdav.password",
  "Backup Files": "settings.verge.backup.files",
  "WebDav Connection Failed": "messages.backup.webdavConnectionFailed",
  "Backup Successful": "messages.backup.success",
  "Backup Failed": "messages.backup.failed",
  "Delete Backup Successful": "messages.backup.deleteSuccess",
  "Delete Backup Failed": "messages.backup.deleteFailed",
  "Apply Backup Successful": "messages.backup.applySuccess",
  "Apply Backup Failed": "messages.backup.applyFailed",
  BK_All: "settings.verge.backup.scopes.all",
  BK_Profiles: "settings.verge.backup.scopes.profiles",
  "App Will Be Restarted Soon": "messages.app.restartSoon",
};

const extraValues = {
  zh: {
    Add: "新增",
    "Can't read monaco content": "无法读取 Monaco 编辑器内容",
    "No Connections": "暂无连接",
    Required: "必填",
    "Web UI": "Web UI",
    "Clash Port": "Clash 端口",
    "No Logs": "暂无日志",
    "No Rules": "暂无规则",
    "Direct Mode": "直连模式",
    "No Proxies": "暂无代理",
  },
  en: {
    Add: "Add",
    "Can't read monaco content": "Can't read monaco content",
    "No Connections": "No Connections",
    Required: "Required",
    "Web UI": "Web UI",
    "Clash Port": "Clash Port",
    "No Logs": "No Logs",
    "No Rules": "No Rules",
    "Direct Mode": "Direct Mode",
    "No Proxies": "No Proxies",
  },
  ru: {
    Add: "Add",
    "Can't read monaco content": "Can't read monaco content",
    "No Connections": "No Connections",
    Required: "Required",
    "Web UI": "Web UI",
    "Clash Port": "Clash Port",
    "No Logs": "No Logs",
    "No Rules": "No Rules",
    "Direct Mode": "Direct Mode",
    "No Proxies": "No Proxies",
  },
  fa: {
    Add: "Add",
    "Can't read monaco content": "Can't read monaco content",
    "No Connections": "No Connections",
    Required: "Required",
    "Web UI": "Web UI",
    "Clash Port": "Clash Port",
    "No Logs": "No Logs",
    "No Rules": "No Rules",
    "Direct Mode": "Direct Mode",
    "No Proxies": "No Proxies",
  },
};

function sanitizeLegacyKey(key) {
  const value = key
    .replace(/\{\{.*?\}\}/g, "")
    .replace(/%/g, " percent ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "value";
  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : lower[0].toUpperCase() + lower.slice(1);
    })
    .join("");
}

function setDeep(target, key, value) {
  const parts = key.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    current[part] ??= {};
    current = current[part];
  }
  current[parts.at(-1)] = value;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const flatLocales = Object.fromEntries(
  localeNames.map((name) => [
    name,
    JSON.parse(fs.readFileSync(path.join(localeDir, `${name}.json`), "utf8")),
  ]),
);

const allKeys = new Set();
for (const locale of Object.values(flatLocales)) {
  for (const key of Object.keys(locale)) {
    allKeys.add(key);
  }
}
for (const key of Object.keys(extraValues.zh)) {
  allKeys.add(key);
}

const fullKeyMap = {};
for (const key of allKeys) {
  fullKeyMap[key] = preferredKeys[key] ?? `legacy.${sanitizeLegacyKey(key)}`;
}

for (const localeName of localeNames) {
  const nested = {};
  for (const key of allKeys) {
    const value =
      flatLocales[localeName][key] ??
      extraValues[localeName]?.[key] ??
      extraValues.zh[key] ??
      flatLocales.zh[key] ??
      key;
    setDeep(nested, fullKeyMap[key], value);
  }
  fs.writeFileSync(
    path.join(localeDir, `${localeName}.json`),
    `${JSON.stringify(nested, null, 2)}\n`,
  );
}

const keymapContent = `export const localeKeyMap = ${JSON.stringify(
  fullKeyMap,
  null,
  2,
)} as const;\n`;
fs.writeFileSync(path.resolve("src/services/i18n-keymap.ts"), keymapContent);

const sourceFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(fullPath);
    }
  }
}

walk(path.resolve("src"));

for (const filePath of sourceFiles) {
  if (filePath.endsWith("src/services/i18n-keymap.ts")) continue;

  let content = fs.readFileSync(filePath, "utf8");
  content = content.replace(
    /\b(i18n\.)?t\(\s*(['"`])([^'"`\n$]+)\2/g,
    (match, prefix = "", quote, key) => {
      const newKey = fullKeyMap[key];
      if (!newKey) return match;
      return `${prefix}t(${quote}${newKey}${quote}`;
    },
  );
  fs.writeFileSync(filePath, content);
}

console.log("Locales and static i18n calls reshaped.");

type Platform =
  | "aix"
  | "android"
  | "darwin"
  | "freebsd"
  | "haiku"
  | "linux"
  | "openbsd"
  | "sunos"
  | "win32"
  | "cygwin"
  | "netbsd";

/**
 * defines in `vite.config.ts`
 */
declare const __OS_PLATFORM__: Platform;

/**
 * Some interface for clash api
 */
interface IConfigData {
  port: number;
  mode: string;
  ipv6: boolean;
  "socket-port": number;
  "allow-lan": boolean;
  "log-level": string;
  "mixed-port": number;
  "redir-port": number;
  "socks-port": number;
  "tproxy-port": number;
  // this filed is only used as a parameter in the patch clash method and is not stored in the clash configuration file
  "enable-random-port": boolean;
  "external-controller": string;
  secret: string;
  "external-controller-cors": {
    "allow-private-network": boolean;
    "allow-origins": string[];
  };
  "unified-delay": boolean;
  "find-process-mode": "always" | "strict" | "off";
  tun: {
    enable?: boolean;
    stack?: string;
    device?: string;
    "auto-route"?: boolean;
    "auto-detect-interface"?: boolean;
    "dns-hijack"?: string[];
    "strict-route"?: boolean;
    mtu?: number;
  };
}

/**
 * Some interface for command
 */

interface IClashInfo {
  // clash mode
  mode: string;
  // status: string;
  mixed_port?: number; // clash mixed port
  socks_port?: number; // clash socks port
  redir_port?: number; // clash redir port
  tproxy_port?: number; // clash tproxy port
  port?: number; // clash http port
  server?: string; // external-controller
  secret?: string;
  cors?: {
    allow_private_network: boolean;
    allow_origins: string[];
  };
}

interface IProfileItem {
  uid: string;
  type?: "local" | "remote" | "merge" | "script";
  name?: string;
  desc?: string;
  file?: string;
  // chain
  parent?: string;
  enable?: boolean;
  scope?: "global" | "specific";
  // profile
  selected?: {
    name?: string;
    now?: string;
  }[];
  chain?: string[];
  // remote profile
  url?: string;
  extra?: {
    upload: number;
    download: number;
    total: number;
    expire: number;
  };
  option?: IProfileOption;
  home?: string;
  updated?: number;
}

interface IProfileOption {
  user_agent?: string;
  with_proxy?: boolean;
  self_proxy?: boolean;
  update_interval?: number;
  danger_accept_invalid_certs?: boolean;
}

interface IProfilesConfig {
  current?: string;
  chain?: string[];
  valid?: string[];
  items?: IProfileItem[];
}

interface IVergeTestItem {
  uid: string;
  name?: string;
  icon?: string;
  url: string;
}

interface IVergeThemeSettings {
  primary_color?: string;
  secondary_color?: string;
  primary_text?: string;
  secondary_text?: string;
  info_color?: string;
  error_color?: string;
  warning_color?: string;
  success_color?: string;
  background_color?: string;
  paper_background_color?: string;
  css_injection?: string;
  font_family?: string;
}

interface IVergeConfig {
  app_log_level?: "trace" | "debug" | "info" | "warn" | "error" | string;
  language?: string;
  tray_event?: "main_window" | "system_proxy" | "tun_mode" | string;
  env_type?: "bash" | "cmd" | "powershell" | string;
  startup_script?: string;
  start_page?: string;
  clash_core?: string;
  theme_mode?: "light" | "dark" | "system";
  traffic_graph?: boolean;
  enable_memory_usage?: boolean;
  enable_group_icon?: boolean;
  menu_icon?: "monochrome" | "colorful" | "disable";
  tray_icon?: "monochrome" | "colorful";
  common_tray_icon?: boolean;
  sysproxy_tray_icon?: boolean;
  tun_tray_icon?: boolean;
  enable_tun_mode?: boolean;
  enable_auto_launch?: boolean;
  enable_system_title_bar?: boolean;
  enable_keep_ui_active?: boolean;
  enable_service_mode?: boolean;
  // enable_silent_start?: boolean;
  silent_start_mode?: "bootup" | "global" | "off";
  enable_system_proxy?: boolean;
  proxy_auto_config?: boolean;
  pac_file_content?: string;
  enable_random_port?: boolean;
  enable_proxy_guard?: boolean;
  proxy_guard_duration?: number;
  bypass?: string;
  windows_bypass?: string;
  macos_bypass?: string;
  linux_bypass?: string;
  web_ui_list?: string[];
  hotkeys?: string[];
  app_hotkeys?: string[];
  // not a verge config, only use it to set the current theme of app
  theme_setting?: IVergeThemeSettings;
  light_theme_setting?: IVergeThemeSettings;
  dark_theme_setting?: IVergeThemeSettings;
  auto_close_connection?: boolean;
  auto_check_update?: boolean;
  default_latency_test?: string;
  default_latency_timeout?: number;
  enable_builtin_enhanced?: boolean;
  auto_log_clean?: 0 | 1 | 2 | 3;
  log_roll_size_mb?: number;
  log_max_keep_files?: number;
  proxy_layout_column?: number;
  test_list?: IVergeTestItem[];
  webdav_url?: string;
  webdav_username?: string;
  webdav_password?: string;
  local_backup_dir?: string;
  enable_tray?: boolean;
  keep_in_dock?: boolean;
  enable_external_controller?: boolean;
}

interface IBackupFile {
  filename: string;
  href: string;
  last_modified: string;
  content_length: number;
  content_type: string;
  tag: string;
}

interface IWebDavConfig {
  url: string;
  username: string;
  password: string;
}

type RulePayload = {
  count: number;
  rules: string[];
};

type SysProxy = {
  enable: boolean;
  server: string;
  bypass: string;
};

type AutoProxy = {
  enable: boolean;
  url: string;
};

type NetInfo = {
  name: string;
  ipv4?: string;
  ipv6?: string;
};

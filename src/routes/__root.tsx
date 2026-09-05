import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import ForkRightRoundedIcon from "@mui/icons-material/ForkRightRounded";
import LanguageRoundedIcon from "@mui/icons-material/LanguageRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import SubjectRoundedIcon from "@mui/icons-material/SubjectRounded";
import WifiRoundedIcon from "@mui/icons-material/WifiRounded";
import WifiTetheringRoundedIcon from "@mui/icons-material/WifiTetheringRounded";
import { createRootRoute } from "@tanstack/react-router";

import ConnectionsSvg from "@/assets/image/itemicon/connections.svg?react";
import LogsSvg from "@/assets/image/itemicon/logs.svg?react";
import ProfilesSvg from "@/assets/image/itemicon/profiles.svg?react";
import ProxiesSvg from "@/assets/image/itemicon/proxies.svg?react";
import RulesSvg from "@/assets/image/itemicon/rules.svg?react";
import SettingsSvg from "@/assets/image/itemicon/settings.svg?react";
import TestSvg from "@/assets/image/itemicon/test.svg?react";
import Layout from "@/pages/_layout";
import NotFountPage from "@/pages/not_found";

export const Route = createRootRoute({
  component: () => <Layout />,
  notFoundComponent: () => <NotFountPage />,
  // errorComponent: () => <BaseErrorBoundary />,
});

export const routes = [
  {
    label: "navigation.sidebar.proxies",
    path: "/",
    icon: [
      <WifiRoundedIcon key="WifiRoundedIcon" />,
      <ProxiesSvg key="ProxiesSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.profiles",
    path: "/profiles",
    icon: [
      <DnsRoundedIcon key="DnsRoundedIcon" />,
      <ProfilesSvg key="ProfilesSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.connections",
    path: "/connections",
    icon: [
      <LanguageRoundedIcon key="LanguageRoundedIcon" />,
      <ConnectionsSvg key="ConnectionsSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.rules",
    path: "/rules",
    icon: [
      <ForkRightRoundedIcon key="ForkRightRoundedIcon" />,
      <RulesSvg key="RulesSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.logs",
    path: "/logs",
    icon: [
      <SubjectRoundedIcon key="SubjectRoundedIcon" />,
      <LogsSvg key="LogsSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.test",
    path: "/test",
    icon: [
      <WifiTetheringRoundedIcon key="WifiTetheringRoundedIcon" />,
      <TestSvg key="TestSvg" />,
    ],
  },
  {
    label: "navigation.sidebar.settings",
    path: "/settings",
    icon: [
      <SettingsRoundedIcon key="SettingsRoundedIcon" />,
      <SettingsSvg key="SettingsSvg" />,
    ],
  },
];

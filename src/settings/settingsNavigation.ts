export const SETTINGS_TABS = [
  { id: "general", label: "常规" },
  { id: "system", label: "系统状态" },
  { id: "input", label: "输入监控" },
  { id: "dialogue", label: "对话与交互" },
  { id: "appearance", label: "控制中心外观" },
] as const;

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

export const INPUT_SETTINGS_TABS = [
  { id: "keyboard", label: "键盘" },
  { id: "typing", label: "打字反馈" },
  { id: "mouse", label: "鼠标" },
] as const;

export type InputSettingsTabId = (typeof INPUT_SETTINGS_TABS)[number]["id"];

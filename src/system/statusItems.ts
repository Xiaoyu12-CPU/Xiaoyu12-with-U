export const SYSTEM_STATUS_ITEMS = [
  { id: "cpu", label: "CPU" },
  { id: "memory", label: "内存" },
  { id: "network", label: "网络" },
  { id: "storage", label: "储存" },
  { id: "battery", label: "电池" },
] as const;

export type SystemStatusItemId = (typeof SYSTEM_STATUS_ITEMS)[number]["id"];

export const SYSTEM_STATUS_ITEM_IDS = SYSTEM_STATUS_ITEMS.map(
  ({ id }) => id,
) as SystemStatusItemId[];

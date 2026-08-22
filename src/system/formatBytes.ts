const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

export function formatBytes(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  const { amount, unit } = normalizeBytes(value);
  return `${formatAmount(amount)} ${unit}`;
}

export function formatBytePair(
  usedBytes: number | undefined,
  totalBytes: number | undefined,
): string {
  if (
    usedBytes === undefined ||
    totalBytes === undefined ||
    !Number.isFinite(usedBytes) ||
    !Number.isFinite(totalBytes)
  ) {
    return "—";
  }

  const normalizedTotal = normalizeBytes(totalBytes);
  const divisor = 1024 ** normalizedTotal.unitIndex;
  const usedAmount = Math.max(0, usedBytes) / divisor;

  return `${formatAmount(usedAmount)} / ${formatAmount(normalizedTotal.amount)} ${normalizedTotal.unit}`;
}

function normalizeBytes(value: number): {
  amount: number;
  unit: (typeof BYTE_UNITS)[number];
  unitIndex: number;
} {
  let amount = Math.max(0, value);
  let unitIndex = 0;

  while (amount >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }

  return {
    amount,
    unit: BYTE_UNITS[unitIndex],
    unitIndex,
  };
}

function formatAmount(value: number): string {
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

import { useTheme } from "./theme";

/**
 * Theme-aware colors for Recharts components. Consume via `useChartTheme()`
 * inside any chart-rendering component so colors flip correctly between
 * light and dark modes.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    axis: dark ? "#475569" : "#94a3b8",
    grid: dark ? "#1e293b" : "#e2e8f0",
    tick: dark ? "#64748b" : "#64748b",
    tooltipBg: dark ? "#111827" : "#ffffff",
    tooltipBorder: dark ? "#1e293b" : "#e5e7eb",
    tooltipText: dark ? "#e2e8f0" : "#111827",
    tooltipLabel: dark ? "#94a3b8" : "#6b7280",
    cursorBg: dark ? "#1f2937" : "#f3f4f6",
    pieStroke: dark ? "#14141d" : "#ffffff",
  };
}

/** Standard tooltip content style props for Recharts. */
export function tooltipProps(ct: ReturnType<typeof useChartTheme>) {
  return {
    contentStyle: {
      background: ct.tooltipBg,
      border: `1px solid ${ct.tooltipBorder}`,
      borderRadius: 8,
      fontSize: 12,
      color: ct.tooltipText,
      boxShadow: "0 8px 24px -12px rgba(0,0,0,0.25)",
    },
    itemStyle: { color: ct.tooltipText },
    labelStyle: { color: ct.tooltipLabel },
    cursor: { fill: ct.cursorBg },
  };
}

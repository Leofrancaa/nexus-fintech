"use client";

export type MilestoneStatus = "planned" | "in_progress" | "done";

export const STATUS_LABELS: Record<MilestoneStatus, string> = {
  planned: "Planejado",
  in_progress: "Em andamento",
  done: "Concluído",
};

export const STATUS_COLORS: Record<MilestoneStatus, string> = {
  planned: "#6b7280",
  in_progress: "#3b82f6",
  done: "#059669",
};

interface Props {
  value: MilestoneStatus;
  onChange: (status: MilestoneStatus) => void;
  disabled?: boolean;
}

export function StatusSelect({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MilestoneStatus)}
      className="text-xs px-2 py-1 rounded-md font-medium text-white border-0 cursor-pointer disabled:opacity-50"
      style={{ backgroundColor: STATUS_COLORS[value] }}
    >
      {(Object.keys(STATUS_LABELS) as MilestoneStatus[]).map((s) => (
        <option key={s} value={s} className="bg-[var(--card-bg)] text-[var(--card-text)]">
          {STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}

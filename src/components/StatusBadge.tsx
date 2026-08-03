import {
  AlertCircle,
  Check,
  Circle,
  Clock3,
  type LucideIcon,
} from "lucide-react";

interface StatusBadgeProps {
  tone: "neutral" | "progress" | "blocked" | "success" | "warning" | "critical";
  label: string;
  compact?: boolean;
}

const ICONS: Record<StatusBadgeProps["tone"], LucideIcon> = {
  neutral: Circle,
  progress: Clock3,
  blocked: AlertCircle,
  success: Check,
  warning: AlertCircle,
  critical: AlertCircle,
};

export function StatusBadge({
  tone,
  label,
  compact = false,
}: StatusBadgeProps) {
  const Icon = ICONS[tone];

  return (
    <span className={`status-badge status-badge--${tone}`}>
      <Icon aria-hidden="true" size={compact ? 12 : 14} strokeWidth={2.2} />
      <span>{label}</span>
    </span>
  );
}

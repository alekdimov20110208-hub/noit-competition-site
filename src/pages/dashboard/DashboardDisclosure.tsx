import { useState, type ReactNode } from "react";

interface DashboardDisclosureProps {
  className: string;
  collapsedLabel: string;
  expandedLabel: string;
  children: ReactNode;
}

// Keep native summary keyboard/expanded semantics; only its visible label changes.
export function DashboardDisclosure({
  className,
  collapsedLabel,
  expandedLabel,
  children,
}: DashboardDisclosureProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <details
      className={className}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary>{expanded ? expandedLabel : collapsedLabel}</summary>
      {children}
    </details>
  );
}

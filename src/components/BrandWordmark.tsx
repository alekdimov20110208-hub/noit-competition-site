interface BrandWordmarkProps {
  compact?: boolean;
}

// Replace this isolated component when the author's final hand-drawn logo is ready.
export function BrandWordmark({ compact = false }: BrandWordmarkProps) {
  return (
    <div className="brand-wordmark" aria-label="BudoGraph">
      <span className="brand-wordmark__text">BudoGraph</span>
      {!compact && (
        <span className="brand-wordmark__tag">Organizer workspace</span>
      )}
    </div>
  );
}

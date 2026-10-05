import type { ReactNode } from "react";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { PreferencesControls } from "../components/PreferencesControls.tsx";

export function AuthShell({
  children,
  context,
  className = "",
}: {
  children: ReactNode;
  context?: ReactNode;
  className?: string;
}) {
  return (
    <div className="auth-screen">
      <header className="auth-header">
        <BrandWordmark compact />
        <PreferencesControls />
      </header>
      <main
        className={`auth-workspace ${context ? "" : "auth-workspace--state"} ${className}`}
        id="main-content"
      >
        {context}
        {children}
      </main>
    </div>
  );
}

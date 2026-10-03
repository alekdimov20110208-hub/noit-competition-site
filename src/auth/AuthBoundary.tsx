import { useEffect, useRef, useState, type ReactNode } from "react";
import { LoginPage } from "../pages/LoginPage.tsx";
import { BrandWordmark } from "../components/BrandWordmark.tsx";
import { PreferencesControls } from "../components/PreferencesControls.tsx";
import { useI18n } from "../i18n/index.ts";
import { auth, useAuth } from "./runtime.ts";
import {
  isLoginPath,
  loginHref,
  replaceAuthLocation,
  safeReturnTo,
} from "./routing.ts";
import "./auth.css";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const state = useAuth();
  const { t } = useI18n();
  const [location, setLocation] = useState(() => window.location.href);
  const hadSession = useRef(false);
  const url = new URL(location);
  const atLogin = isLoginPath(url.pathname);
  const returnTo = safeReturnTo(url.searchParams.get("returnTo"));

  useEffect(() => {
    void auth.refresh();
    const recheck = () => {
      if (document.visibilityState === "visible") void auth.refresh();
    };
    const onLocation = () => {
      setLocation(window.location.href);
      void auth.refresh();
    };
    // Revalidate on actual navigation without altering the locked page history.
    const onLink = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]"))
        recheck();
    };
    window.addEventListener("popstate", onLocation);
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);
    document.addEventListener("visibilitychange", recheck);
    document.addEventListener("click", onLink);
    return () => {
      window.removeEventListener("popstate", onLocation);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
      document.removeEventListener("visibilitychange", recheck);
      document.removeEventListener("click", onLink);
    };
  }, []);

  useEffect(() => {
    if (state.status === "authenticated") {
      hadSession.current = true;
      if (atLogin) replaceAuthLocation(returnTo);
    } else if (state.status === "unauthenticated" && !atLogin) {
      replaceAuthLocation(
        loginHref(
          window.location.pathname + window.location.search,
          hadSession.current,
        ),
      );
      hadSession.current = false;
    }
  }, [state.status, atLogin, returnTo, location]);

  if (
    state.status === "loading" ||
    (state.status === "authenticated" && atLogin)
  ) {
    return (
      <div className="auth-screen">
        <header className="auth-header">
          <BrandWordmark compact />
          <PreferencesControls />
        </header>
        <main className="auth-check" role="status">
          <p>{t("auth.checking")}</p>
        </main>
      </div>
    );
  }
  if (state.status === "unauthenticated") {
    return (
      <LoginPage
        bootstrapError={state.error}
        expired={url.searchParams.get("reason") === "expired"}
      />
    );
  }
  return children;
}

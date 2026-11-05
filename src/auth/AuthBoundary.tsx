import { useEffect, useRef, useState, type ReactNode } from "react";
import { LandingPage } from "../pages/LandingPage.tsx";
import { LoginPage } from "../pages/LoginPage.tsx";
import { AuthShell } from "./AuthShell.tsx";
import { useI18n } from "../i18n/index.ts";
import { auth, useAuth } from "./runtime.ts";
import {
  isLoginPath,
  loginHref,
  replaceAuthLocation,
  safeReturnTo,
} from "./routing.ts";
import "./auth.css";
import { InvitationPage } from "../pages/InvitationPage.tsx";
import { readInvitationToken } from "../services/invitations.ts";
import { AccountSafetyPage } from "../pages/AccountSafetyPage.tsx";
import { SignupPage } from "../pages/SignupPage.tsx";
import { signupAvailability } from "./signup.ts";

export function AuthBoundary({ children }: { children: ReactNode }) {
  const state = useAuth();
  const { t } = useI18n();
  const [location, setLocation] = useState(() => window.location.href);
  const hadSession = useRef(false);
  const url = new URL(location);
  const atRoot = url.pathname === "/";
  const atLogin = isLoginPath(url.pathname);
  const atSignup = url.pathname === "/signup";
  const [signupEnabled, setSignupEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void signupAvailability(
      AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    ).then((enabled) => {
      if (!controller.signal.aborted) setSignupEnabled(enabled);
    });
    return () => controller.abort();
  }, []);
  const atInvitation = url.pathname.startsWith("/invite/");
  const safety =
    url.pathname === "/forgot-password"
      ? "forgot"
      : url.pathname === "/reset-password"
        ? "reset"
        : url.pathname === "/verify-email"
          ? "verify"
          : null;
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
      if (atLogin || atSignup) replaceAuthLocation(returnTo);
    } else if (
      state.status === "unauthenticated" &&
      (!atRoot || hadSession.current) &&
      !atLogin &&
      !atSignup &&
      !atInvitation &&
      !safety
    ) {
      replaceAuthLocation(
        loginHref(
          window.location.pathname + window.location.search,
          hadSession.current,
        ),
      );
      hadSession.current = false;
    }
  }, [
    state.status,
    atRoot,
    atLogin,
    atSignup,
    atInvitation,
    returnTo,
    location,
    safety,
  ]);

  // Only the exact public root can render before the session is confirmed.
  if (atRoot && state.status !== "authenticated" && !hadSession.current)
    return <LandingPage signupEnabled={signupEnabled} />;

  if (
    state.status === "loading" ||
    (state.status === "authenticated" && (atLogin || atSignup))
  ) {
    return (
      <AuthShell>
        <div className="auth-check" role="status">
          <p>{t("auth.checking")}</p>
        </div>
      </AuthShell>
    );
  }
  if (safety)
    return <AccountSafetyPage key={url.pathname + url.search} mode={safety} />;
  if (atSignup) return <SignupPage enabled={signupEnabled} />;
  if (atInvitation)
    return (
      <InvitationPage
        key={url.pathname}
        token={readInvitationToken(url.pathname)}
      />
    );
  if (state.status === "unauthenticated") {
    return (
      <LoginPage
        signupEnabled={signupEnabled === true}
        bootstrapError={state.error}
        expired={url.searchParams.get("reason") === "expired"}
      />
    );
  }
  return children;
}

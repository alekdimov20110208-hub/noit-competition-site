import { useEffect, useState } from "react";
import { startLocalCalendarClock } from "./localCalendarClock.ts";

export function useLocalCalendarNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const clock = startLocalCalendarClock(setNow);
    const onVisible = () => {
      if (document.visibilityState === "visible") clock.refresh();
    };
    window.addEventListener("focus", clock.refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clock.stop();
      window.removeEventListener("focus", clock.refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return now;
}

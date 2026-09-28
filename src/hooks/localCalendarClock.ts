export function millisecondsUntilLocalMidnight(now: Date): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

// One timer at a time; reread the clock after sleep or a delayed callback.
// Return a restart function so a resumed tab can refresh and rearm the timer.
export function startLocalCalendarClock(
  onChange: (now: Date) => void,
  readNow = () => new Date(),
  schedule = (callback: () => void, delay: number) =>
    setTimeout(callback, delay),
  cancel = (timer: ReturnType<typeof setTimeout>) => clearTimeout(timer),
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  function refresh() {
    if (timer !== undefined) cancel(timer);
    const now = readNow();
    onChange(now);
    timer = schedule(refresh, millisecondsUntilLocalMidnight(now));
  }
  // Sample on effect startup as well: rendering may have crossed midnight
  // before the hook's effect subscribed.
  refresh();
  return {
    refresh,
    stop: () => {
      if (timer !== undefined) cancel(timer);
    },
  };
}

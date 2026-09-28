export function isVisibleFocusTarget(element: HTMLElement): boolean {
  if (!element.isConnected || element.getClientRects().length === 0)
    return false;
  // Closed details descendants can still report rectangles, but cannot take focus.
  for (
    let parent = element.closest("details:not([open])");
    parent;
    parent = parent.parentElement?.closest("details:not([open])") ?? null
  ) {
    if (!parent.querySelector(":scope > summary")?.contains(element))
      return false;
  }
  return getComputedStyle(element).visibility === "visible";
}

export function revealFocusTarget(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const header = document.querySelector(".app-header")?.getBoundingClientRect();
  const nav = document.querySelector(".mobile-nav")?.getBoundingClientRect();
  const top = (header?.bottom ?? 0) + 12;
  const bottom = nav && nav.height > 0 ? nav.top - 12 : window.innerHeight - 12;
  const offset =
    rect.top < top || rect.height > bottom - top
      ? rect.top - top
      : rect.bottom > bottom
        ? rect.bottom - bottom
        : 0;
  if (offset) window.scrollBy({ top: offset, behavior: "instant" });
}

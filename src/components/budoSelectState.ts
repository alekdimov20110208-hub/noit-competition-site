export type ListboxNavigation = "first" | "last" | "next" | "previous";
export type ListboxDismissal = "cancel" | "commit";

export interface SelectOptionValue {
  value: string;
}

export interface PopupGeometryInput {
  triggerLeft: number;
  triggerTop: number;
  triggerBottom: number;
  triggerWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  popupMinWidth: number;
  contentHeight: number;
  gutter?: number;
  gap?: number;
  maxPopupHeight?: number;
}

export interface PopupGeometry {
  placement: "above" | "below";
  width: number;
  maxHeight: number;
  offsetX: number;
}

export function getSelectedOptionIndex(
  options: readonly SelectOptionValue[],
  selectedValue: string,
): number {
  const selectedIndex = options.findIndex(
    (option) => option.value === selectedValue,
  );

  return selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1;
}

export function getNavigatedOptionIndex(
  optionCount: number,
  currentIndex: number,
  navigation: ListboxNavigation,
): number {
  if (optionCount <= 0) return -1;

  const safeIndex = Math.min(Math.max(currentIndex, 0), optionCount - 1);

  switch (navigation) {
    case "first":
      return 0;
    case "last":
      return optionCount - 1;
    case "next":
      return Math.min(safeIndex + 1, optionCount - 1);
    case "previous":
      return Math.max(safeIndex - 1, 0);
  }
}

export function resolveListboxValue<Value extends string>(
  options: readonly { value: Value }[],
  selectedValue: Value,
  activeIndex: number,
  dismissal: ListboxDismissal,
): Value {
  if (dismissal === "cancel") return selectedValue;

  return options[activeIndex]?.value ?? selectedValue;
}

export function getPopupGeometry({
  triggerLeft,
  triggerTop,
  triggerBottom,
  triggerWidth,
  viewportWidth,
  viewportHeight,
  popupMinWidth,
  contentHeight,
  gutter = 12,
  gap = 6,
  maxPopupHeight = 260,
}: PopupGeometryInput): PopupGeometry {
  const availableViewportWidth = Math.max(0, viewportWidth - gutter * 2);
  const width = Math.min(
    Math.max(triggerWidth, popupMinWidth),
    availableViewportWidth,
  );
  const left = Math.min(
    Math.max(triggerLeft, gutter),
    Math.max(gutter, viewportWidth - gutter - width),
  );
  const spaceBelow = Math.max(0, viewportHeight - triggerBottom - gap - gutter);
  const spaceAbove = Math.max(0, triggerTop - gap - gutter);
  const idealHeight = Math.min(contentHeight, maxPopupHeight);
  const placement =
    spaceBelow >= idealHeight
      ? "below"
      : spaceAbove >= idealHeight
        ? "above"
        : spaceAbove > spaceBelow
          ? "above"
          : "below";
  const availableHeight = placement === "above" ? spaceAbove : spaceBelow;

  return {
    placement,
    width,
    maxHeight: Math.max(0, Math.min(maxPopupHeight, availableHeight)),
    offsetX: left - triggerLeft,
  };
}

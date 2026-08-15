import { Check, ChevronDown } from "lucide-react";
import {
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  getNavigatedOptionIndex,
  getPopupGeometry,
  getSelectedOptionIndex,
  resolveListboxValue,
  type ListboxNavigation,
  type PopupGeometry,
} from "./budoSelectState.ts";

export interface BudoSelectOption<Value extends string = string> {
  value: Value;
  label: string;
}

interface BudoSelectProps<Value extends string> {
  id: string;
  label: string;
  value: Value;
  options: readonly BudoSelectOption<Value>[];
  onChange: (value: Value) => void;
  className?: string;
  icon?: ReactNode;
  labelMode?: "visible" | "sr-only";
  popupMinWidth?: number;
}

type PopupStyle = CSSProperties & {
  "--budo-select-popup-width": string;
  "--budo-select-popup-offset": string;
  "--budo-select-popup-height": string;
};

const DEFAULT_LAYOUT: PopupGeometry = {
  placement: "below",
  width: 180,
  maxHeight: 260,
  offsetX: 0,
};

export function BudoSelect<Value extends string>({
  id,
  label,
  value,
  options,
  onChange,
  className = "",
  icon,
  labelMode = "visible",
  popupMinWidth = 180,
}: BudoSelectProps<Value>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const triggerPointerDownRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    getSelectedOptionIndex(options, value),
  );
  const [layout, setLayout] = useState(DEFAULT_LAYOUT);
  const labelId = `${id}-label`;
  const valueId = `${id}-value`;
  const listboxId = `${id}-listbox`;
  const selectedIndex = getSelectedOptionIndex(options, value);
  const selectedOption =
    selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const focusOption = useCallback((index: number) => {
    if (index < 0) return;
    setActiveIndex(index);
    const option = optionRefs.current[index];
    option?.focus({ preventScroll: true });
    const listbox = listboxRef.current;
    if (!option || !listbox) return;

    const optionRect = option.getBoundingClientRect();
    const listboxRect = listbox.getBoundingClientRect();
    if (optionRect.top < listboxRect.top) {
      listbox.scrollTop -= listboxRect.top - optionRect.top;
    } else if (optionRect.bottom > listboxRect.bottom) {
      listbox.scrollTop += optionRect.bottom - listboxRect.bottom;
    }
  }, []);

  const closeAndFocusTrigger = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  const openListbox = useCallback(
    (initialIndex = selectedIndex) => {
      setActiveIndex(initialIndex);
      setOpen(true);
    },
    [selectedIndex],
  );

  const updatePopupLayout = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const nextLayout = getPopupGeometry({
      triggerLeft: rect.left,
      triggerTop: rect.top,
      triggerBottom: rect.bottom,
      triggerWidth: rect.width,
      viewportWidth: document.documentElement.clientWidth,
      viewportHeight: document.documentElement.clientHeight,
      popupMinWidth,
      contentHeight: Math.max(
        options.length * 40 + 8,
        listboxRef.current?.scrollHeight ?? 0,
      ),
    });

    setLayout((current) =>
      current.placement === nextLayout.placement &&
      current.width === nextLayout.width &&
      current.maxHeight === nextLayout.maxHeight &&
      current.offsetX === nextLayout.offsetX
        ? current
        : nextLayout,
    );
  }, [options.length, popupMinWidth]);

  useLayoutEffect(() => {
    if (!open) return;

    updatePopupLayout();
    const frame = window.requestAnimationFrame(() => focusOption(activeIndex));
    window.addEventListener("resize", updatePopupLayout);
    window.addEventListener("scroll", updatePopupLayout, true);
    window.visualViewport?.addEventListener("resize", updatePopupLayout);
    window.visualViewport?.addEventListener("scroll", updatePopupLayout);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePopupLayout);
      window.removeEventListener("scroll", updatePopupLayout, true);
      window.visualViewport?.removeEventListener("resize", updatePopupLayout);
      window.visualViewport?.removeEventListener("scroll", updatePopupLayout);
    };
  }, [activeIndex, focusOption, open, updatePopupLayout]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [open]);

  useEffect(() => {
    if (!open) setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  function navigate(navigation: ListboxNavigation) {
    focusOption(
      getNavigatedOptionIndex(options.length, activeIndex, navigation),
    );
  }

  function selectOption(index: number) {
    const nextValue = resolveListboxValue(options, value, index, "commit");
    if (nextValue === value && !options[index]) return;
    onChange(nextValue);
    closeAndFocusTrigger();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) closeAndFocusTrigger();
      else openListbox();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (open) {
        navigate(event.key === "ArrowDown" ? "next" : "previous");
      } else {
        openListbox();
      }
      return;
    }

    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
    }
  }

  function handleTriggerPointerDown() {
    triggerPointerDownRef.current = true;
    window.setTimeout(() => {
      triggerPointerDownRef.current = false;
    }, 0);
  }

  function handleTriggerClick() {
    triggerPointerDownRef.current = false;
    if (open) closeAndFocusTrigger();
    else openListbox();
  }

  function handleListboxKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    const navigationByKey: Partial<Record<string, ListboxNavigation>> = {
      ArrowDown: "next",
      ArrowUp: "previous",
      Home: "first",
      End: "last",
    };
    const navigation = navigationByKey[event.key];

    if (navigation) {
      event.preventDefault();
      navigate(navigation);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectOption(activeIndex);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeAndFocusTrigger();
      return;
    }
  }

  function handleRootBlur(event: ReactFocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget === triggerRef.current && triggerPointerDownRef.current) {
      return;
    }

    if (
      nextTarget === triggerRef.current ||
      !rootRef.current?.contains(nextTarget)
    ) {
      setOpen(false);
    }
  }

  const popupStyle: PopupStyle = {
    "--budo-select-popup-width": `${layout.width}px`,
    "--budo-select-popup-offset": `${layout.offsetX}px`,
    "--budo-select-popup-height": `${layout.maxHeight}px`,
  };

  return (
    <div
      ref={rootRef}
      className={`budo-select ${className}`.trim()}
      data-open={open || undefined}
      onBlur={handleRootBlur}
    >
      <span
        id={labelId}
        className={`budo-select__label ${labelMode === "sr-only" ? "sr-only" : ""}`.trim()}
      >
        {label}
      </span>
      <div className="budo-select__control">
        <button
          ref={triggerRef}
          id={`${id}-trigger`}
          className="budo-select__trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-labelledby={`${labelId} ${valueId}`}
          onPointerDown={handleTriggerPointerDown}
          onClick={handleTriggerClick}
          onKeyDown={handleTriggerKeyDown}
        >
          {icon}
          <span id={valueId} className="budo-select__value">
            {selectedOption?.label ?? value}
          </span>
          <ChevronDown
            className="budo-select__chevron"
            size={14}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ul
            ref={listboxRef}
            id={listboxId}
            className="budo-select__listbox"
            role="listbox"
            aria-labelledby={labelId}
            data-placement={layout.placement}
            style={popupStyle}
            onKeyDown={handleListboxKeyDown}
          >
            {options.map((option, index) => {
              const selected = index === selectedIndex;
              const active = index === activeIndex;

              return (
                <li
                  ref={(element) => {
                    optionRefs.current[index] = element;
                  }}
                  id={`${id}-option-${index}`}
                  key={option.value}
                  className="budo-select__option"
                  role="option"
                  aria-selected={selected}
                  data-active={active || undefined}
                  tabIndex={active ? 0 : -1}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => selectOption(index)}
                >
                  <span>{option.label}</span>
                  {selected && <Check size={15} aria-hidden="true" />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

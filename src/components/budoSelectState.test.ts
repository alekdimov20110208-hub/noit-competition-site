import assert from "node:assert/strict";
import test from "node:test";
import {
  getNavigatedOptionIndex,
  getPopupGeometry,
  getSelectedOptionIndex,
  resolveListboxValue,
} from "./budoSelectState.ts";

const options = [
  { value: "all" },
  { value: "active" },
  { value: "blocked" },
] as const;

test("listbox opening resolves selection by value rather than option order", () => {
  assert.equal(getSelectedOptionIndex(options, "blocked"), 2);
  assert.equal(
    getSelectedOptionIndex([options[2], options[0], options[1]], "blocked"),
    0,
  );
  assert.equal(getSelectedOptionIndex(options, "unknown"), 0);
  assert.equal(getSelectedOptionIndex([], "unknown"), -1);
});

test("Arrow, Home, and End navigation stays within option bounds", () => {
  assert.equal(getNavigatedOptionIndex(3, 0, "previous"), 0);
  assert.equal(getNavigatedOptionIndex(3, 0, "next"), 1);
  assert.equal(getNavigatedOptionIndex(3, 2, "next"), 2);
  assert.equal(getNavigatedOptionIndex(3, 1, "first"), 0);
  assert.equal(getNavigatedOptionIndex(3, 1, "last"), 2);
  assert.equal(getNavigatedOptionIndex(0, 0, "next"), -1);
});

test("commit accepts only a valid active option while cancellation preserves selection", () => {
  assert.equal(resolveListboxValue(options, "active", 2, "commit"), "blocked");
  assert.equal(resolveListboxValue(options, "active", 9, "commit"), "active");
  assert.equal(resolveListboxValue(options, "active", 2, "cancel"), "active");
});

test("popup geometry clamps width and horizontal position to the viewport", () => {
  const geometry = getPopupGeometry({
    triggerLeft: 280,
    triggerTop: 120,
    triggerBottom: 158,
    triggerWidth: 80,
    viewportWidth: 320,
    viewportHeight: 700,
    popupMinWidth: 260,
    contentHeight: 220,
    gutter: 8,
  });

  assert.equal(geometry.placement, "below");
  assert.equal(geometry.width, 260);
  assert.equal(280 + geometry.offsetX + geometry.width, 312);
  assert.equal(geometry.maxHeight, 260);
});

test("popup chooses the roomier side and keeps its scrolling height bounded", () => {
  const geometry = getPopupGeometry({
    triggerLeft: 100,
    triggerTop: 610,
    triggerBottom: 648,
    triggerWidth: 160,
    viewportWidth: 390,
    viewportHeight: 700,
    popupMinWidth: 220,
    contentHeight: 600,
    maxPopupHeight: 240,
  });

  assert.equal(geometry.placement, "above");
  assert.equal(geometry.maxHeight, 240);
  assert.ok(geometry.width >= 220);

  const partiallyFittingBelow = getPopupGeometry({
    triggerLeft: 100,
    triggerTop: 518,
    triggerBottom: 556,
    triggerWidth: 160,
    viewportWidth: 900,
    viewportHeight: 744,
    popupMinWidth: 220,
    contentHeight: 600,
  });
  assert.equal(partiallyFittingBelow.placement, "above");
  assert.equal(partiallyFittingBelow.maxHeight, 260);
});

test("popup height never exceeds the available viewport side", () => {
  const geometry = getPopupGeometry({
    triggerLeft: 20,
    triggerTop: 15,
    triggerBottom: 66,
    triggerWidth: 120,
    viewportWidth: 320,
    viewportHeight: 80,
    popupMinWidth: 180,
    contentHeight: 200,
    gutter: 8,
    gap: 6,
  });

  assert.equal(geometry.placement, "above");
  assert.equal(geometry.maxHeight, 1);
});

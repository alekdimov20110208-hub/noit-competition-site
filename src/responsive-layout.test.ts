import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

test("status badges keep labels intact", () => {
  assert.match(
    styles,
    /\.status-badge\s*\{[^}]*overflow-wrap:\s*normal;[^}]*white-space:\s*nowrap;[^}]*word-break:\s*normal;/s,
  );
});

test("mobile navigation reserves safe-area-aware page space", () => {
  assert.match(
    styles,
    /\.mobile-nav\s*\{[\s\S]*min-height:\s*calc\(66px \+ env\(safe-area-inset-bottom, 0px\)\);/,
  );
  assert.match(
    styles,
    /\.app-main\s*\{[^}]*padding:\s*28px 20px calc\(106px \+ env\(safe-area-inset-bottom, 0px\)\);/s,
  );
});

test("Tasks use a purpose-built mobile summary instead of stacked desktop columns", () => {
  assert.match(
    styles,
    /@media \(max-width: 600px\) \{[\s\S]*\.task-row\s*\{[^}]*grid-template-areas:\s*"task task"\s*"status status"\s*"responsibility deadline";/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\) \{[\s\S]*\.task-row__context \.status-badge,[\s\S]*\.task-row__status \.status-badge\s*\{[^}]*font-size:\s*0\.7rem;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\) \{[\s\S]*\.task-row__context > span:first-child\s*\{[^}]*font-size:\s*0\.7rem;/,
  );
  assert.match(styles, /\.task-deadline time\s*\{[^}]*white-space:\s*nowrap;/s);
});

test("task drawer uses dynamic viewport height and safe-area-aware content", () => {
  assert.match(styles, /\.task-drawer\s*\{[^}]*height:\s*100dvh;/s);
  assert.match(
    styles,
    /\.task-drawer__content\s*\{[^}]*env\(safe-area-inset-bottom, 0px\)/s,
  );
});

test("Tasks custom selection controls expose visible focus and bounded scrolling", () => {
  assert.match(
    styles,
    /\.budo-select__trigger:focus-visible,[\s\S]*\.budo-select\[data-open="true"\] \.budo-select__trigger\s*\{[^}]*border-color:\s*var\(--focus-ring\);[^}]*box-shadow:/,
  );
  assert.match(
    styles,
    /\.budo-select__listbox\s*\{[^}]*max-height:\s*var\(--budo-select-popup-height, 260px\);[^}]*overflow-y:\s*auto;/s,
  );
});

test("narrow Tasks controls move the result count below search", () => {
  assert.match(
    styles,
    /@media \(max-width: 420px\) \{[\s\S]*\.task-filters__result\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1;[^}]*text-align:\s*left;/,
  );
});

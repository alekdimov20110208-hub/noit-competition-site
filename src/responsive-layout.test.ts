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
    /@media \(max-width: 600px\) \{[\s\S]*\.task-row__context \.status-badge,[\s\S]*\.task-row__status \.status-badge\s*\{[^}]*font-size:\s*0\.75rem;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 600px\) \{[\s\S]*\.task-row__context > span:first-child\s*\{[^}]*font-size:\s*0\.75rem;/,
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

test("constrained task results reuse the compact row based on available content width", () => {
  assert.match(
    styles,
    /#task-results\s*\{[^}]*container:\s*task-results\s*\/\s*inline-size;/s,
  );
  const compact = styles.slice(
    styles.indexOf("@container task-results (max-width: 50rem)"),
    styles.indexOf("@media (max-width: 600px)"),
  );
  assert.match(
    compact,
    /\.task-row\s*\{[^}]*grid-template-areas:\s*"task task task"\s*"responsibility deadline status";/s,
  );
  for (const [selector, area] of [
    ["task-row__primary", "task"],
    ["task-responsibility", "responsibility"],
    ["task-deadline", "deadline"],
    ["task-row__status", "status"],
  ]) {
    assert.match(
      compact,
      new RegExp(`\\.${selector}\\s*\\{[^}]*grid-area:\\s*${area};`, "s"),
    );
  }
  // Only column headings use the pre-existing visually hidden treatment;
  // operational cells stay present, with unchanged fonts and wrapping.
  assert.doesNotMatch(compact, /display:\s*none|text-overflow|font-size/);
});

test("wide task register retains four columns before compact overrides", () => {
  const register = styles.match(
    /\.task-register__header,\s*\.task-row\s*\{([^}]+)\}/s,
  )?.[1];
  assert.ok(register);
  assert.equal(register.match(/minmax\(/g)?.length, 4);
  assert.doesNotMatch(register, /grid-template-areas/);
});

test("drawer header and bottom navigation protect scrolling content with solid theme surfaces", () => {
  for (const selector of ["task-drawer__topbar", "mobile-nav"]) {
    assert.match(
      styles,
      new RegExp(
        `\\.${selector}\\s*\\{[^}]*position:\\s*(?:sticky|fixed);[^}]*background:\\s*var\\(--surface\\);`,
        "s",
      ),
    );
  }
});

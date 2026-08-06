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

test("mobile dashboard sections use deliberate stacked compositions", () => {
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*\.operational-metric:first-child\s*\{[^}]*grid-column:\s*1 \/ -1;/,
  );
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*\.deadline-item\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/,
  );
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*\.workload-row__details\s*\{[^}]*grid-row:\s*3;/,
  );
  assert.match(
    styles,
    /\.change-summary \.affected-task-list > a,[\s\S]*\.affected-task-list > div\s*\{[^}]*flex-direction:\s*column;/,
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

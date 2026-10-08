import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

// Supply an existing verification renderer; it is not an application dependency.
const { default: sharp } = await import(
  process.env.BUDOGRAPH_SHARP_MODULE
    ? pathToFileURL(process.env.BUDOGRAPH_SHARP_MODULE).href
    : "sharp"
);
const root = new URL("../public/brand/", import.meta.url);
const canonical = (
  await readFile(new URL("budograph-monogram.svg", root), "utf8")
).replace(/\r\n/g, "\n");
const paths = [...canonical.matchAll(/<path fill="([^"]+)" d="([^"]+)"\/>/g)];
assert.equal(
  paths.length,
  2,
  "The approved canonical mark has exactly two paths.",
);
assert.deepEqual(
  paths.map((p) => p[1]),
  ["#0F2A44", "#F0766B"],
);
assert.ok(paths.every((p) => p[2].endsWith("Z")));
const check = process.argv.includes("--check");
const manifest = {
  canonical: "budograph-monogram.svg",
  geometry:
    "Approved Concept 3; all exports reuse canonical path data unchanged.",
  textEncoding: "UTF-8/LF; text hashes and checks normalize checkout CRLF",
  colors: {
    navy: "#0F2A44",
    coral: "#F0766B",
    inverseCream: "#FBF7F3",
    background: "#111C2B",
  },
  exports: [],
};
function variant({ size = 224, inverse = false, background = false } = {}) {
  // Only the canvas/translation and fills differ. Neither path is redrawn.
  const x = (size - 180) / 2,
    y = (size - 164) / 2;
  return canonical
    .replace('viewBox="0 0 224 224"', `viewBox="0 0 ${size} ${size}"`)
    .replace('transform="translate(22 30)"', `transform="translate(${x} ${y})"`)
    .replace('fill="#0F2A44"', `fill="${inverse ? "#FBF7F3" : "#0F2A44"}"`)
    .replace(
      "</title>",
      `</title>${background ? `<rect width="${size}" height="${size}" fill="#111C2B"/>` : ""}`,
    );
}
async function output(name, data, purpose) {
  const buffer = Buffer.from(data);
  if (check) {
    const existing = await readFile(new URL(name, root));
    const normalized =
      name.endsWith(".svg") || name.endsWith(".json")
        ? Buffer.from(existing.toString("utf8").replace(/\r\n/g, "\n"))
        : existing;
    assert.deepEqual(normalized, buffer, `${name} is stale`);
  } else await writeFile(new URL(name, root), buffer);
  manifest.exports.push({
    file: name,
    purpose,
    bytes: buffer.length,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  });
}
await output(
  "budograph-monogram.svg",
  canonical,
  "Canonical transparent navy/coral geometry",
);
await output(
  "budograph-monogram-inverse.svg",
  variant({ inverse: true }),
  "Derived transparent cream/coral treatment",
);
const favicon = variant({ inverse: true, background: true });
await output(
  "favicon.svg",
  favicon,
  "Opaque navy with cream/coral; one treatment for every browser theme",
);
const app = variant({ size: 256, inverse: true, background: true });
await output(
  "app-icon.svg",
  app,
  "Approved inset app-icon treatment for square/circle contexts",
);
const maskable = variant({ size: 320, inverse: true, background: true });
await output(
  "app-icon-maskable.svg",
  maskable,
  "Additional inset; verified within the central 80% safe circle",
);
// Every visible point lies inside this conservative bounding rectangle. All
// corners are within the maskable 80% circle (radius 128 on a 320 canvas).
const boundRadius = Math.hypot(180 / 2, 164 / 2);
assert.ok(boundRadius < 320 * 0.4);
manifest.maskableSafeArea = {
  canvas: 320,
  visibleBounds: [70, 78, 250, 242],
  boundingRadius: boundRadius,
  safeRadius: 128,
  verified: true,
};
for (const size of [192, 512]) {
  for (const [prefix, svg] of [
    ["app-icon", app],
    ["app-icon-maskable", maskable],
  ]) {
    const png = await sharp(Buffer.from(svg), { density: 384 })
      .resize(size, size)
      .png()
      .toBuffer();
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, size);
    assert.equal(metadata.height, size);
    await output(
      `${prefix}-${size}.png`,
      png,
      `${size}px opaque export derived from ${prefix}.svg`,
    );
  }
}
await output(
  "asset-manifest.json",
  JSON.stringify(manifest, null, 2) + "\n",
  "Export inventory",
);
console.log(
  `${check ? "Verified" : "Exported"} canonical and derived brand assets at ${fileURLToPath(root)}; maskable bounds fit the safe circle.`,
);

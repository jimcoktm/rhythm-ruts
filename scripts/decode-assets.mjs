import fs from "node:fs";
import path from "node:path";

const pairs = [
  ["public/sprites/bike-body.png", "public/sprites/bike-body.png.b64", "public/sprites/bike-body.png.parts"],
  ["public/sprites/wheel.png", "public/sprites/wheel.png.b64", "public/sprites/wheel.png.parts"],
  ["public/og.jpg", "public/og.jpg.b64", "public/og.jpg.parts"],
  ["public/x-banner.jpg", "public/x-banner.jpg.b64", "public/x-banner.jpg.parts"],
];

function readPacked(b64, partsDir) {
  if (fs.existsSync(b64)) return fs.readFileSync(b64, "utf8");
  if (!fs.existsSync(partsDir)) return null;
  const names = fs.readdirSync(partsDir).filter((n) => /^\d+$/.test(n)).sort();
  if (!names.length) return null;
  return names.map((n) => fs.readFileSync(path.join(partsDir, n), "utf8")).join("");
}

for (const [dest, b64, partsDir] of pairs) {
  const text = readPacked(b64, partsDir);
  if (!text) continue;
  const buf = Buffer.from(text.replace(/\s/g, ""), "base64");
  if (fs.existsSync(dest) && fs.statSync(dest).size === buf.length) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

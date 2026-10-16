import fs from "node:fs";
import path from "node:path";

const pairs = [
  ["public/sprites/bike-body.png.b64", "public/sprites/bike-body.png"],
  ["public/sprites/wheel.png.b64", "public/sprites/wheel.png"],
  ["public/og.jpg.b64", "public/og.jpg"],
  ["public/x-banner.jpg.b64", "public/x-banner.jpg"],
];

for (const [src, dest] of pairs) {
  if (!fs.existsSync(src)) continue;
  const buf = Buffer.from(fs.readFileSync(src, "utf8").replace(/\s/g, ""), "base64");
  if (fs.existsSync(dest) && fs.statSync(dest).size === buf.length) continue;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
}

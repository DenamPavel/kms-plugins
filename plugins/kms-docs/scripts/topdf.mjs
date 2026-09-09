import { chromium } from "playwright";
const [src, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
await p.goto("file://" + src, { waitUntil: "networkidle" });
// The page's own @media print block is the design; emulate print so it applies.
await p.emulateMedia({ media: "print" });
await p.pdf({
  path: out,
  format: "Letter",
  printBackground: true,
  margin: { top: "17mm", bottom: "17mm", left: "16mm", right: "16mm" },
});
await b.close();
console.log("wrote " + out);

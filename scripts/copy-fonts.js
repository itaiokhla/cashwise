const fs = require("fs");
const path = require("path");

const src = path.resolve(__dirname, "../node_modules/pdfkit/js/data");
const targets = [
  path.resolve(__dirname, "../.next/server/vendor-chunks/data"),
  path.resolve(__dirname, "../.next/server/data"),
];

if (fs.existsSync(src)) {
  for (const target of targets) {
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.cpSync(src, target, { recursive: true });
      console.log(`Copied pdfkit fonts to ${target}`);
    } catch (e) {
      // Ignored if target directory structure not yet generated
    }
  }
}

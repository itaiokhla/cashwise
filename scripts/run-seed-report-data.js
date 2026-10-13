const path = require("path");
const jiti = require("jiti")(__dirname, {
  alias: {
    "@app": path.resolve(__dirname, "../app"),
  },
});

jiti("./seed-report-data.ts");

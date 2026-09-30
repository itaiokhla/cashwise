const path = require("path");
const jiti = require("jiti")(__dirname, {
  alias: {
    "@app": path.resolve(__dirname, "../app"),
    "@redux": path.resolve(__dirname, "../redux"),
    "@createRequest": path.resolve(__dirname, "../createRequest"),
  },
});

jiti("./seed.ts");

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const logger = require("./logger");

describe("logger", () => {
  it("prefixes messages with MMM-WebRTC", () => {
    assert.equal(logger.MODULE_NAME, "MMM-WebRTC");
    assert.equal(logger.prefixMessage("starting"), "MMM-WebRTC: starting");
    assert.equal(logger.prefixMessage("MMM-WebRTC: already tagged"), "MMM-WebRTC: already tagged");
    assert.equal(logger.prefixMessage("[MMM-WebRTC] already tagged"), "[MMM-WebRTC] already tagged");
  });

  it("writes the module name to console.log", () => {
    const original = console.log;
    const lines = [];
    console.log = (...args) => {
      lines.push(args.map(String).join(" "));
    };
    try {
      logger.log("node helper started");
      logger.log({ camera: "front" });
    } finally {
      console.log = original;
    }
    assert.equal(lines[0], "MMM-WebRTC: node helper started");
    assert.match(lines[1], /^MMM-WebRTC:/);
  });
});

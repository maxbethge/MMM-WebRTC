const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { isHeaderEnabled, headerText } = require("./header");

describe("header", () => {
  it("hides the header when showHeader is false", () => {
    assert.equal(isHeaderEnabled({ showHeader: false }, { header: "Front Door" }), false);
    assert.equal(headerText({ showHeader: false }, { header: "Front Door" }), "");
    assert.equal(isHeaderEnabled({ showHeader: "false" }, { header: "Front Door" }), false);
  });

  it("hides the header when showHeader is set on module data", () => {
    assert.equal(isHeaderEnabled({ showHeader: true }, { showHeader: false, header: "Cam" }), false);
  });

  it("shows the configured MagicMirror header by default", () => {
    assert.equal(isHeaderEnabled({ showHeader: true }, { header: "Front Door" }), true);
    assert.equal(headerText({ showHeader: true }, { header: "Front Door" }), "Front Door");
    assert.equal(headerText({ header: "Porch" }, {}), "Porch");
  });
});

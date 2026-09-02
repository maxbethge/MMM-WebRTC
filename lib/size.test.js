const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { cssSize, isAuto, moduleBox } = require("./size");

describe("size", () => {
  it("treats bare numbers as pixels", () => {
    assert.equal(cssSize(480, "100%"), "480px");
    assert.equal(cssSize("270", "auto"), "270px");
    assert.equal(cssSize("50%", "100%"), "50%");
    assert.equal(cssSize("12rem", "auto"), "12rem");
    assert.equal(cssSize(null, "100%"), "100%");
  });

  it("builds a module box from width and height", () => {
    assert.deepEqual(moduleBox({ width: 640, height: 360, objectFit: "cover" }), {
      width: "640px",
      height: "360px",
      objectFit: "cover",
      fixedHeight: true
    });
    assert.equal(moduleBox({}).width, "100%");
    assert.equal(moduleBox({}).height, "auto");
    assert.equal(moduleBox({}).fixedHeight, false);
    assert.equal(isAuto("auto"), true);
    assert.equal(isAuto(200), false);
  });
});

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { parseAnswer } = require("./sdp");

const SDP = "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0";

describe("sdp", () => {
  it("returns a raw SDP answer", () => {
    assert.equal(parseAnswer(SDP), SDP);
  });

  it("parses JSON WHEP answers", () => {
    assert.equal(parseAnswer(JSON.stringify({ type: "answer", sdp: SDP })), SDP);
    assert.equal(parseAnswer({ value: SDP }), SDP);
  });

  it("decodes a base64 SDP payload", () => {
    assert.equal(parseAnswer(Buffer.from(SDP, "utf8").toString("base64")), SDP);
  });

  it("rejects empty or unknown answers", () => {
    assert.throws(() => parseAnswer(""), /empty/);
    assert.throws(() => parseAnswer("not-sdp"), /unrecognized/);
  });
});

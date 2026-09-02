const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { buildEndpoints, applyQueryParam, httpToWs, interpolate, isBareOrigin } = require("./stream-url");

describe("stream-url", () => {
  it("uses a full URI as-is", () => {
    const endpoints = buildEndpoints({
      url: "http://nvr:8083/stream/front_door/channel/0/webrtc"
    });
    assert.equal(endpoints.viewUrl, "http://nvr:8083/stream/front_door/channel/0/webrtc");
    assert.equal(endpoints.whepUrl, "http://nvr:8083/stream/front_door/channel/0/webrtc");
    assert.equal(endpoints.signaling, "whep");
  });

  it("builds the Frigate/go2rtc webrtc.html viewer URL", () => {
    const endpoints = buildEndpoints({
      url: "http://192.168.1.10:1984",
      camera: "front_door"
    });
    assert.equal(endpoints.viewUrl, "http://192.168.1.10:1984/webrtc.html?src=front_door");
    assert.equal(endpoints.whepUrl, "http://192.168.1.10:1984/api/webrtc?src=front_door");
    assert.equal(endpoints.wsUrl, "ws://192.168.1.10:1984/api/ws?src=front_door");
    assert.equal(endpoints.signaling, "iframe");
  });

  it("uses a full webrtc.html URI as-is", () => {
    const endpoints = buildEndpoints({
      url: "http://192.168.1.10:1984/webrtc.html?src=driveway"
    });
    assert.equal(endpoints.viewUrl, "http://192.168.1.10:1984/webrtc.html?src=driveway");
    assert.equal(endpoints.camera, "driveway");
    assert.equal(endpoints.signaling, "iframe");
  });

  it("interpolates {camera} in a custom URI", () => {
    const endpoints = buildEndpoints({
      url: "http://nvr:8889/api/ws?src={camera}",
      camera: "porch"
    });
    assert.equal(endpoints.viewUrl, "http://nvr:8889/api/ws?src=porch");
    assert.equal(endpoints.wsUrl, "ws://nvr:8889/api/ws?src=porch");
    assert.equal(endpoints.signaling, "websocket");
  });

  it("does not rewrite a custom origin to Frigate live-proxy paths", () => {
    const endpoints = buildEndpoints({
      url: "http://192.168.1.10:5000",
      camera: "driveway"
    });
    assert.equal(endpoints.viewUrl, "http://192.168.1.10:5000/webrtc.html?src=driveway");
    assert.equal(endpoints.whepUrl.includes("/live/webrtc/"), false);
  });

  it("uses custom viewPath, whepPath, and wsPath when provided", () => {
    const endpoints = buildEndpoints({
      url: "http://192.168.1.10:5000",
      camera: "driveway",
      viewPath: "/live/webrtc/webrtc.html",
      whepPath: "/live/webrtc/api/webrtc",
      wsPath: "/live/webrtc/api/ws"
    });
    assert.equal(endpoints.viewUrl, "http://192.168.1.10:5000/live/webrtc/webrtc.html?src=driveway");
    assert.equal(endpoints.whepUrl, "http://192.168.1.10:5000/live/webrtc/api/webrtc?src=driveway");
    assert.equal(endpoints.wsUrl, "ws://192.168.1.10:5000/live/webrtc/api/ws?src=driveway");
  });

  it("honors uri and wsUrl aliases", () => {
    const endpoints = buildEndpoints({
      uri: "http://nvr:1984/webrtc.html",
      camera: "porch",
      wsUrl: "http://nvr:1984/api/ws"
    });
    assert.equal(endpoints.viewUrl, "http://nvr:1984/webrtc.html?src=porch");
    assert.equal(endpoints.wsUrl, "ws://nvr:1984/api/ws?src=porch");
    assert.equal(endpoints.signaling, "iframe");
  });

  it("skips appending camera when appendCamera is false", () => {
    const endpoints = buildEndpoints({
      url: "http://nvr:1984/webrtc.html?token=abc",
      camera: "ignored",
      appendCamera: false
    });
    assert.equal(endpoints.viewUrl, "http://nvr:1984/webrtc.html?token=abc");
  });

  it("applies a custom src query name", () => {
    assert.equal(
      applyQueryParam("http://nvr/play", "stream", "cam1"),
      "http://nvr/play?stream=cam1"
    );
  });

  it("converts http to ws and detects a bare origin", () => {
    assert.equal(httpToWs("https://nvr.home/api/ws"), "wss://nvr.home/api/ws");
    assert.equal(isBareOrigin("http://192.168.1.10:1984"), true);
    assert.equal(isBareOrigin("http://192.168.1.10:1984/webrtc.html"), false);
    assert.equal(interpolate("src={camera}", { camera: "a b" }), "src=a%20b");
  });
});

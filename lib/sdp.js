(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MMMWebRTCSdp = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function decodeBase64(text) {
    if (typeof Buffer !== "undefined") {
      return Buffer.from(text, "base64").toString("utf8");
    }
    if (typeof atob === "function") {
      return atob(text);
    }
    throw new Error("no base64 decoder available");
  }

  function extractSdp(value) {
    if (typeof value !== "string") {
      return "";
    }
    const text = value.trim();
    const index = text.indexOf("v=");
    if (index >= 0) {
      return text.slice(index);
    }
    return "";
  }

  function parseAnswer(body) {
    if (body == null) {
      throw new Error("empty SDP answer");
    }
    if (typeof body === "object") {
      if (body.sdp) {
        return parseAnswer(body.sdp);
      }
      if (body.value) {
        return parseAnswer(body.value);
      }
      if (body.data) {
        return parseAnswer(body.data);
      }
      throw new Error("unrecognized SDP answer object");
    }

    const text = String(body).trim();
    if (!text) {
      throw new Error("empty SDP answer");
    }

    if (text.indexOf("v=") === 0) {
      return text;
    }

    if (text.charAt(0) === "{" || text.charAt(0) === "[") {
      try {
        const json = JSON.parse(text);
        if (json && typeof json === "object") {
          if (json.sdp) {
            return parseAnswer(json.sdp);
          }
          if (json.value) {
            return parseAnswer(json.value);
          }
          if (json.data) {
            return parseAnswer(json.data);
          }
        }
      } catch (e) {
        // not JSON; try base64 next
      }
    }

    try {
      const decoded = decodeBase64(text);
      const fromB64 = extractSdp(decoded);
      if (fromB64) {
        return fromB64;
      }
    } catch (e) {
      // ignore
    }

    throw new Error("unrecognized SDP answer");
  }

  return {
    decodeBase64,
    extractSdp,
    parseAnswer
  };
});

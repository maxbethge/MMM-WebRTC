(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MMMWebRTCSize = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function cssSize(value, fallback) {
    if (value == null || value === "") {
      return fallback;
    }
    if (typeof value === "number") {
      if (!isFinite(value)) {
        return fallback;
      }
      return `${value}px`;
    }
    const text = String(value).trim();
    if (!text) {
      return fallback;
    }
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return `${text}px`;
    }
    return text;
  }

  function isAuto(value) {
    const size = cssSize(value, "auto");
    return !size || size === "auto";
  }

  function moduleBox(config) {
    const width = cssSize(config && config.width, "100%");
    const height = cssSize(config && config.height, "auto");
    return {
      width,
      height,
      objectFit: (config && config.objectFit) || "contain",
      fixedHeight: !isAuto(height)
    };
  }

  return {
    cssSize,
    isAuto,
    moduleBox
  };
});

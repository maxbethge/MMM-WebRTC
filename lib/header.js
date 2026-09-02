(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MMMWebRTCHeader = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function isFalseFlag(value) {
    return value === false || value === 0 || value === "false" || value === "0";
  }

  function isHeaderEnabled(config, data) {
    if (config && isFalseFlag(config.showHeader)) {
      return false;
    }
    if (data && isFalseFlag(data.showHeader)) {
      return false;
    }
    if (config && (config.header === false || config.header === "")) {
      return false;
    }
    return true;
  }

  function headerText(config, data) {
    if (!isHeaderEnabled(config, data)) {
      return "";
    }
    const fromData = data && data.header;
    if (typeof fromData === "string" && fromData.trim()) {
      return fromData;
    }
    const fromConfig = config && config.header;
    if (typeof fromConfig === "string" && fromConfig.trim()) {
      return fromConfig;
    }
    return "";
  }

  return {
    isFalseFlag,
    isHeaderEnabled,
    headerText
  };
});

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MMMWebRTCLogger = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  const MODULE_NAME = "MMM-WebRTC";

  function prefixMessage(message) {
    if (typeof message !== "string") {
      return `${MODULE_NAME}:`;
    }
    if (message.indexOf(MODULE_NAME) === 0 || message.indexOf(`[${MODULE_NAME}]`) === 0) {
      return message;
    }
    return `${MODULE_NAME}: ${message}`;
  }

  function consoleMethod(level) {
    if (typeof console === "undefined") {
      return null;
    }
    if (typeof console[level] === "function") {
      return console[level].bind(console);
    }
    if (typeof console.log === "function") {
      return console.log.bind(console);
    }
    return null;
  }

  function emit(level, args) {
    const list = Array.prototype.slice.call(args);
    if (list.length === 0) {
      list.push("");
    }
    if (typeof list[0] === "string") {
      list[0] = prefixMessage(list[0]);
    } else {
      list.unshift(`${MODULE_NAME}:`);
    }

    if (typeof Log !== "undefined" && typeof Log[level] === "function") {
      Log[level].apply(Log, list);
      return;
    }
    if (typeof Log !== "undefined" && level === "debug" && typeof Log.log === "function") {
      Log.log.apply(Log, list);
      return;
    }

    const write = consoleMethod(level) || consoleMethod("log");
    if (write) {
      write.apply(null, list);
    }
  }

  return {
    MODULE_NAME,
    prefixMessage,
    log() {
      emit("log", arguments);
    },
    info() {
      emit("info", arguments);
    },
    warn() {
      emit("warn", arguments);
    },
    error() {
      emit("error", arguments);
    },
    debug() {
      emit("debug", arguments);
    }
  };
});

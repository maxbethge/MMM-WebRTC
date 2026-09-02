(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.MMMWebRTCStreamUrl = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  function firstString() {
    for (let i = 0; i < arguments.length; i += 1) {
      const value = arguments[i];
      if (value != null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  function stripSlash(url) {
    return String(url || "").replace(/\/+$/, "");
  }

  function parseUrl(url) {
    try {
      return new URL(url);
    } catch (e) {
      return null;
    }
  }

  function originOf(url) {
    const parsed = parseUrl(url);
    return parsed ? parsed.origin : "";
  }

  function pathnameOf(url) {
    const parsed = parseUrl(url);
    if (parsed) {
      return parsed.pathname;
    }
    return String(url || "").split("?")[0];
  }

  function httpToWs(url) {
    return String(url || "").replace(/^http/i, "ws");
  }

  function interpolate(template, vars) {
    return String(template || "").replace(/\{(camera|src)\}/g, (_, key) => {
      const value = (vars && (vars[key] || vars.camera || vars.src)) || "";
      return encodeURIComponent(value);
    });
  }

  function hasPlaceholder(template) {
    return /\{(camera|src)\}/.test(String(template || ""));
  }

  function isBareOrigin(url) {
    const parsed = parseUrl(url);
    if (!parsed) {
      return false;
    }
    return (!parsed.pathname || parsed.pathname === "/") && !parsed.search && !parsed.hash;
  }

  function isViewerPage(url) {
    return /\.html$/i.test(pathnameOf(url));
  }

  function isWhepPath(url) {
    return /\/api\/webrtc\/?$/i.test(pathnameOf(url));
  }

  function isWsPath(url) {
    const parsed = parseUrl(url);
    if (parsed && /^wss?:$/i.test(parsed.protocol)) {
      return true;
    }
    return /\/api\/ws\/?$/i.test(pathnameOf(url));
  }

  function joinUrl(base, path) {
    const origin = stripSlash(base);
    let suffix = String(path || "");
    if (!suffix) {
      return origin;
    }
    if (!/^[/?]/.test(suffix)) {
      suffix = `/${suffix}`;
    }
    return `${origin}${suffix}`;
  }

  function applyQueryParam(url, name, value) {
    if (!url || !name || !value) {
      return url;
    }
    const parsed = parseUrl(url);
    if (parsed) {
      if (!parsed.searchParams.has(name)) {
        parsed.searchParams.set(name, value);
      }
      return parsed.toString();
    }
    if (new RegExp(`[?&]${name}=`).test(url)) {
      return url;
    }
    const join = url.indexOf("?") >= 0 ? "&" : "?";
    return `${url}${join}${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
  }

  function replacePath(url, fromPath, toPath) {
    const from = String(fromPath || "").split("?")[0];
    const to = String(toPath || "").split("?")[0];
    if (!url || !from || from === to) {
      return url;
    }
    const parsed = parseUrl(url);
    if (parsed && parsed.pathname.indexOf(from) >= 0) {
      parsed.pathname = parsed.pathname.split(from).join(to);
      return parsed.toString();
    }
    if (String(url).indexOf(from) >= 0) {
      return String(url).split(from).join(to);
    }
    return url;
  }

  function maybeAppendCamera(url, config, camera, originalTemplate) {
    if (!url || !camera) {
      return url;
    }
    if (config && config.appendCamera === false) {
      return url;
    }
    if (hasPlaceholder(originalTemplate)) {
      return url;
    }
    const srcParam = firstString(config && config.srcParam, "src") || "src";
    return applyQueryParam(url, srcParam, camera);
  }

  function detectSignaling(config, viewUrl) {
    const requested = firstString(config && config.signaling, "auto") || "auto";
    if (requested !== "auto") {
      return requested;
    }
    if (isViewerPage(viewUrl)) {
      return "iframe";
    }
    if (isWsPath(viewUrl)) {
      return "websocket";
    }
    return "whep";
  }

  function buildEndpoints(config) {
    const srcParam = firstString(config && config.srcParam, "src") || "src";
    let camera = firstString(config && config.camera, config && config.src);
    const vars = { camera, src: camera };
    const viewPath = interpolate(
      firstString(config && config.viewPath, config && config.path, "/webrtc.html") || "/webrtc.html",
      vars
    );
    const whepPath = interpolate(firstString(config && config.whepPath, "/api/webrtc") || "/api/webrtc", vars);
    const wsPath = interpolate(firstString(config && config.wsPath, "/api/ws") || "/api/ws", vars);

    const rawUrl = firstString(
      config && config.webrtcUrl,
      config && config.uri,
      config && config.url,
      config && config.frigateUrl
    );
    const rawWs = firstString(config && config.wsUrl);

    let url = interpolate(rawUrl, vars);
    let wsUrl = interpolate(rawWs, vars);

    if (!camera && url) {
      const parsed = parseUrl(url);
      if (parsed) {
        camera = parsed.searchParams.get(srcParam) || "";
        vars.camera = camera;
        vars.src = camera;
      }
    }

    let viewUrl = "";
    let whepUrl = "";

    if (url) {
      if (isBareOrigin(url)) {
        viewUrl = maybeAppendCamera(joinUrl(url, viewPath), config, camera, rawUrl);
        whepUrl = maybeAppendCamera(joinUrl(url, whepPath), config, camera, rawUrl);
        if (!wsUrl) {
          wsUrl = joinUrl(url, wsPath);
        }
      } else if (isViewerPage(url)) {
        viewUrl = maybeAppendCamera(url, config, camera, rawUrl);
        const origin = originOf(url);
        if (origin) {
          whepUrl = maybeAppendCamera(joinUrl(origin, whepPath), config, camera, "");
          if (!wsUrl) {
            wsUrl = joinUrl(origin, wsPath);
          }
        }
      } else if (isWsPath(url)) {
        viewUrl = maybeAppendCamera(url, config, camera, rawUrl);
        whepUrl = maybeAppendCamera(replacePath(url, wsPath, whepPath), config, camera, rawUrl);
        if (!wsUrl) {
          wsUrl = url;
        }
      } else {
        viewUrl = maybeAppendCamera(url, config, camera, rawUrl);
        whepUrl = viewUrl;
        if (!wsUrl) {
          const swapped = replacePath(url, whepPath, wsPath);
          if (swapped !== url) {
            wsUrl = swapped;
          }
        }
      }
    }

    if (wsUrl && isBareOrigin(wsUrl)) {
      wsUrl = joinUrl(wsUrl, wsPath);
    }
    if (wsUrl) {
      wsUrl = httpToWs(maybeAppendCamera(wsUrl, config, camera, rawWs || rawUrl));
    }

    return {
      camera,
      baseUrl: url,
      viewUrl,
      whepUrl,
      wsUrl,
      signaling: detectSignaling(config, viewUrl)
    };
  }

  return {
    firstString,
    stripSlash,
    httpToWs,
    interpolate,
    isBareOrigin,
    isViewerPage,
    isWhepPath,
    joinUrl,
    applyQueryParam,
    buildEndpoints
  };
});

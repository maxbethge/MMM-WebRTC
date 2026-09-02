Module.register("MMM-WebRTC", {
  requiresVersion: "2.1.0",

  defaults: {
    url: null,
    uri: null,
    frigateUrl: null,
    camera: null,
    src: null,
    webrtcUrl: null,
    wsUrl: null,
    path: null,
    viewPath: "/webrtc.html",
    whepPath: "/api/webrtc",
    wsPath: "/api/ws",
    srcParam: "src",
    appendCamera: true,
    signaling: "auto",
    header: null,
    showHeader: true,
    width: "100%",
    height: "auto",
    objectFit: "contain",
    muted: true,
    audio: false,
    controls: false,
    refreshInterval: 0,
    reconnectDelay: 5,
    iceTimeout: 2000,
    stunServers: ["stun:stun.l.google.com:19302"]
  },

  start() {
    this.logger = typeof MMMWebRTCLogger !== "undefined" ? MMMWebRTCLogger : console;
    this.endpoints =
      typeof MMMWebRTCStreamUrl !== "undefined"
        ? MMMWebRTCStreamUrl.buildEndpoints(this.config)
        : {
            viewUrl: this.config.uri || this.config.url,
            whepUrl: this.config.webrtcUrl || this.config.uri || this.config.url,
            wsUrl: this.config.wsUrl,
            camera: this.config.camera,
            signaling: this.config.signaling || "auto"
          };
    this.parseAnswer =
      typeof MMMWebRTCSdp !== "undefined"
        ? MMMWebRTCSdp.parseAnswer.bind(MMMWebRTCSdp)
        : (sdp) => sdp;
    this.size =
      typeof MMMWebRTCSize !== "undefined"
        ? MMMWebRTCSize
        : {
            moduleBox(config) {
              return {
                width: config.width || "100%",
                height: config.height || "auto",
                objectFit: config.objectFit || "contain",
                fixedHeight: Boolean(config.height && config.height !== "auto")
              };
            }
          };
    this.header =
      typeof MMMWebRTCHeader !== "undefined"
        ? MMMWebRTCHeader
        : {
            isHeaderEnabled(config, data) {
              return !(config && config.showHeader === false) && !(data && data.showHeader === false);
            },
            headerText(config, data) {
              if (config && config.showHeader === false) {
                return "";
              }
              return (data && data.header) || (config && config.header) || "";
            }
          };

    this.pc = null;
    this.ws = null;
    this.stream = null;
    this.wrapper = null;
    this.video = null;
    this.iframe = null;
    this.statusEl = null;
    this.refreshTimer = null;
    this.reconnectTimer = null;
    this.connecting = false;
    this.suspended = false;
    this.hasVideo = false;
    this.errorMessage = null;
    this.offerId = 0;
    this.generation = 0;

    this.hideConfiguredHeader();

    const box = this.size.moduleBox(this.config);
    this.logger.log(
      `starting camera=${this.endpoints.camera || "(none)"} signaling=${this.endpoints.signaling} size=${box.width}x${box.height} uri=${this.endpoints.viewUrl || this.endpoints.whepUrl || this.endpoints.wsUrl || "(none)"}`
    );

    if (!this.endpoints.viewUrl && !this.endpoints.whepUrl && !this.endpoints.wsUrl) {
      this.errorMessage = "Set url or uri to a WebRTC endpoint";
      this.logger.error(this.errorMessage);
    }

    this.scheduleRefresh();
  },

  stop() {
    this.clearTimers();
    this.teardown("stop");
  },

  suspend() {
    this.suspended = true;
    this.logger.log("suspending stream");
    this.teardown("suspend");
  },

  resume() {
    this.suspended = false;
    this.logger.log("resuming stream");
    this.connect("resume");
  },

  getScripts() {
    return [
      this.file("lib/logger.js"),
      this.file("lib/stream-url.js"),
      this.file("lib/sdp.js"),
      this.file("lib/size.js"),
      this.file("lib/header.js")
    ];
  },

  getStyles() {
    return [this.file("MMM-WebRTC.css")];
  },

  getHeader() {
    this.hideConfiguredHeader();
    if (!this.header || typeof this.header.headerText !== "function") {
      return this.config && this.config.showHeader === false ? undefined : this.data && this.data.header;
    }
    const text = this.header.headerText(this.config, this.data);
    return text || undefined;
  },

  getDom() {
    if (!this.wrapper) {
      this.wrapper = document.createElement("div");
      this.wrapper.className = "mmm-webrtc";

      this.video = document.createElement("video");
      this.video.className = "mmm-webrtc-video";
      this.video.autoplay = true;
      this.video.playsInline = true;
      this.video.muted = this.config.muted !== false;
      this.video.controls = Boolean(this.config.controls);
      this.video.setAttribute("playsinline", "");
      this.video.disablePictureInPicture = true;
      this.video.addEventListener("playing", () => this.setPlaying());
      this.video.addEventListener("stalled", () => this.scheduleReconnect("stalled"));
      this.video.addEventListener("error", () => this.scheduleReconnect("video-error"));

      this.iframe = document.createElement("iframe");
      this.iframe.className = "mmm-webrtc-frame";
      this.iframe.setAttribute("title", "MMM-WebRTC stream");
      this.iframe.setAttribute("allow", "autoplay; fullscreen; encrypted-media");
      this.iframe.setAttribute("scrolling", "no");
      this.iframe.setAttribute("frameborder", "0");
      this.iframe.allowFullscreen = true;

      this.statusEl = document.createElement("div");
      this.statusEl.className = "mmm-webrtc-status";

      this.wrapper.appendChild(this.video);
      this.wrapper.appendChild(this.iframe);
      this.wrapper.appendChild(this.statusEl);
      this.applyModuleSize();
    }

    this.applyModuleChrome();
    this.renderState();
    if (!this._didConnect) {
      this._didConnect = true;
      setTimeout(() => {
        this.applyModuleChrome();
        this.connect("dom");
      }, 0);
    }
    return this.wrapper;
  },

  notificationReceived(notification, payload) {
    if (notification === "MODULE_DOM_CREATED") {
      this.applyModuleChrome();
      this.connect("startup");
      return;
    }

    if (notification === "USER_PRESENCE") {
      if (payload) {
        if (this.suspended) {
          this.resume();
        }
      } else if (!this.suspended) {
        this.suspend();
      }
      return;
    }

    if (notification === "MMM_WEBRTC_RESTART") {
      const camera = payload && payload.camera;
      if (!camera || camera === this.endpoints.camera) {
        this.restart("notification");
      }
    }
  },

  socketNotificationReceived(notification, payload) {
    if (notification === `ANSWER_${this.identifier}`) {
      this.handleAnswer(payload);
      return;
    }
    if (notification === `ERROR_${this.identifier}`) {
      const message = (payload && payload.message) || "WHEP request failed";
      if (payload && payload.offerId && payload.offerId !== this.offerId) {
        return;
      }
      this.logger.error(message);
      this.errorMessage = message;
      this.renderState();
      this.scheduleReconnect("whep-error");
    }
  },

  applyModuleChrome() {
    this.hideConfiguredHeader();
    const moduleEl = this.moduleElement();
    if (!moduleEl) {
      return;
    }
    const show = this.header && this.header.isHeaderEnabled
      ? this.header.isHeaderEnabled(this.config, this.data)
      : this.config.showHeader !== false;
    moduleEl.classList.toggle("mmm-webrtc-no-header", !show);
    const headerEl = moduleEl.querySelector(".module-header, header");
    if (headerEl) {
      if (show) {
        headerEl.hidden = false;
        headerEl.removeAttribute("hidden");
        headerEl.style.removeProperty("display");
      } else {
        headerEl.hidden = true;
        headerEl.setAttribute("hidden", "hidden");
        headerEl.innerHTML = "";
        headerEl.style.setProperty("display", "none", "important");
      }
    }
    this.applyModuleSize();
  },

  hideConfiguredHeader() {
    if (!this.header || typeof this.header.isHeaderEnabled !== "function") {
      return;
    }
    if (this.header.isHeaderEnabled(this.config, this.data)) {
      return;
    }
    if (this.data && this.data.header) {
      this._savedHeader = this.data.header;
      this.data.header = undefined;
      this.logger.log("header hidden because showHeader is false");
    }
  },

  moduleElement() {
    if (this.identifier) {
      const byId = document.getElementById(this.identifier);
      if (byId) {
        return byId;
      }
    }
    if (this.wrapper && this.wrapper.closest) {
      return this.wrapper.closest(".module");
    }
    return null;
  },

  applyModuleSize() {
    const box = this.size.moduleBox(this.config);
    const moduleEl = document.getElementById(this.identifier);
    if (moduleEl) {
      moduleEl.style.width = box.width;
      moduleEl.style.maxWidth = box.width;
      moduleEl.classList.toggle("mmm-webrtc-sized", box.width !== "100%" || box.fixedHeight);
    }
    if (this.wrapper) {
      this.wrapper.style.width = "100%";
      this.wrapper.style.height = box.fixedHeight ? box.height : "";
      this.wrapper.classList.toggle("mmm-webrtc-fixed", box.fixedHeight);
    }
    if (this.iframe) {
      this.iframe.style.width = "100%";
      this.iframe.style.height = "100%";
      this.iframe.style.border = "0";
    }
    if (this.video) {
      this.video.style.width = "100%";
      this.video.style.height = box.fixedHeight ? "100%" : "auto";
      this.video.style.maxWidth = "100%";
      this.video.style.maxHeight = box.fixedHeight ? "100%" : "";
      this.video.style.objectFit = box.objectFit;
    }
  },

  scheduleRefresh() {
    clearInterval(this.refreshTimer);
    this.refreshTimer = null;
    const seconds = Number(this.config.refreshInterval) || 0;
    if (seconds <= 0) {
      return;
    }
    this.logger.log(`stream will restart every ${seconds}s`);
    this.refreshTimer = setInterval(() => {
      this.logger.log(`scheduled stream restart after ${seconds}s`);
      this.restart("refresh");
    }, seconds * 1000);
  },

  restart(reason) {
    this.logger.log(`restarting stream (${reason})`);
    this.teardown(reason);
    this.connect(reason);
  },

  connect(reason) {
    if (this.suspended) {
      return;
    }
    if (this.connecting) {
      return;
    }
    const mode = this.endpoints.signaling || this.config.signaling || "auto";
    if (mode !== "iframe" && this.pc && this.pc.connectionState !== "closed" && this.pc.connectionState !== "failed") {
      return;
    }
    if (!this.endpoints.viewUrl && !this.endpoints.whepUrl && !this.endpoints.wsUrl) {
      return;
    }

    this.connecting = true;
    this.errorMessage = null;
    this.generation += 1;
    const generation = this.generation;
    this.logger.log(`connecting via ${mode} (${reason})`);
    this.renderState();

    if (mode === "iframe") {
      this.connectIframe(generation);
      return;
    }

    this.createPeerConnection(generation)
      .then(() => {
        if (generation !== this.generation) {
          return;
        }
        if (mode === "websocket") {
          return this.connectWebsocket(generation);
        }
        return this.connectWhep(generation);
      })
      .catch((err) => {
        if (generation !== this.generation) {
          return;
        }
        const message = err && err.message ? err.message : String(err);
        this.logger.error(`connect failed: ${message}`);
        this.errorMessage = message;
        this.connecting = false;
        this.renderState();
        this.scheduleReconnect("connect-failed");
      });
  },

  connectIframe(generation) {
    if (!this.iframe) {
      this.connecting = false;
      this.errorMessage = "Stream iframe is not ready";
      this.logger.error(this.errorMessage);
      this.renderState();
      return;
    }
    if (!this.endpoints.viewUrl) {
      this.connecting = false;
      this.errorMessage = "Set url or uri to a WebRTC endpoint";
      this.logger.error(this.errorMessage);
      this.renderState();
      return;
    }

    this.wrapper.classList.add("has-iframe");
    this.iframe.onload = () => {
      if (generation !== this.generation) {
        return;
      }
      if (!this.iframe.src || this.iframe.src.indexOf("about:blank") === 0) {
        return;
      }
      this.logger.log(`iframe loaded ${this.endpoints.viewUrl}`);
      this.setPlaying();
    };
    this.iframe.onerror = () => {
      if (generation !== this.generation) {
        return;
      }
      this.logger.error(`iframe failed to load ${this.endpoints.viewUrl}`);
      this.errorMessage = "Failed to load webrtc.html";
      this.connecting = false;
      this.renderState();
      this.scheduleReconnect("iframe-error");
    };

    const loadViewer = () => {
      if (generation !== this.generation) {
        return;
      }
      this.iframe.src = this.endpoints.viewUrl;
    };

    if (this.iframe.getAttribute("src") && this.iframe.getAttribute("src") !== "about:blank") {
      this.iframe.src = "about:blank";
      setTimeout(loadViewer, 0);
      return;
    }
    loadViewer();
  },

  async createPeerConnection(generation) {
    this.teardownPeer();

    const iceServers = (this.config.stunServers || []).map((urls) => ({ urls }));
    this.pc = new RTCPeerConnection({
      bundlePolicy: "max-bundle",
      iceServers
    });
    this.stream = new MediaStream();

    this.pc.addTransceiver("video", { direction: "recvonly" });
    if (this.config.audio) {
      this.pc.addTransceiver("audio", { direction: "recvonly" });
    }

    this.pc.ontrack = (event) => {
      if (generation !== this.generation) {
        return;
      }
      this.stream.addTrack(event.track);
      if (this.video) {
        this.video.srcObject = this.stream;
        this.video.play().catch(() => {
          this.logger.warn("video play() was blocked");
        });
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (!this.pc || generation !== this.generation) {
        return;
      }
      this.logger.log(`connection state ${this.pc.connectionState}`);
      if (this.pc.connectionState === "failed" || this.pc.connectionState === "disconnected") {
        this.scheduleReconnect(this.pc.connectionState);
      }
    };
  },

  async connectWhep(generation) {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce(this.pc, this.config.iceTimeout);

    if (generation !== this.generation) {
      return;
    }

    this.offerId += 1;
    this.sendSocketNotification("OFFER", {
      identifier: this.identifier,
      whepUrl: this.endpoints.whepUrl,
      sdp: this.pc.localDescription.sdp,
      offerId: this.offerId
    });
    this.connecting = false;
  },

  connectWebsocket(generation) {
    if (!this.endpoints.wsUrl) {
      throw new Error("wsUrl is not configured");
    }

    this.teardownWebsocket();
    this.ws = new WebSocket(this.endpoints.wsUrl);

    this.ws.addEventListener("open", () => {
      if (generation !== this.generation || !this.pc) {
        return;
      }
      this.logger.log("signaling websocket open");
      this.pc.onicecandidate = (event) => {
        if (!event.candidate || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
          return;
        }
        this.ws.send(
          JSON.stringify({
            type: "webrtc/candidate",
            value: event.candidate.candidate
          })
        );
      };
      this.pc
        .createOffer()
        .then((offer) => this.pc.setLocalDescription(offer))
        .then(() => {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
          }
          this.ws.send(
            JSON.stringify({
              type: "webrtc/offer",
              value: this.pc.localDescription.sdp
            })
          );
          this.connecting = false;
        })
        .catch((err) => {
          this.logger.error(`websocket offer failed: ${err.message}`);
          this.scheduleReconnect("ws-offer");
        });
    });

    this.ws.addEventListener("message", (event) => {
      if (generation !== this.generation) {
        return;
      }
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        this.logger.warn("ignoring non-JSON signaling message");
        return;
      }
      if (msg.type === "webrtc/candidate" && msg.value && this.pc) {
        this.pc.addIceCandidate({ candidate: msg.value, sdpMid: "0" }).catch((err) => {
          this.logger.warn(`ICE candidate failed: ${err.message}`);
        });
      } else if (msg.type === "webrtc/answer") {
        this.handleAnswer({ sdp: msg.value, offerId: this.offerId });
      } else if (msg.type === "error") {
        this.logger.error(String(msg.value || "signaling error"));
        this.scheduleReconnect("ws-error");
      }
    });

    this.ws.addEventListener("close", () => {
      if (generation !== this.generation || this.suspended) {
        return;
      }
      this.logger.warn("signaling websocket closed");
      this.scheduleReconnect("ws-close");
    });

    this.ws.addEventListener("error", () => {
      this.logger.error("signaling websocket error");
    });
  },

  handleAnswer(payload) {
    if (!this.pc) {
      return;
    }
    if (payload && payload.offerId && payload.offerId !== this.offerId) {
      this.logger.log("ignoring stale SDP answer");
      return;
    }
    try {
      const sdp = this.parseAnswer(payload && payload.sdp != null ? payload.sdp : payload);
      this.pc.setRemoteDescription({ type: "answer", sdp });
      this.connecting = false;
      this.logger.log("remote description set");
    } catch (err) {
      this.logger.error(`SDP answer failed: ${err.message}`);
      this.errorMessage = err.message;
      this.renderState();
      this.scheduleReconnect("sdp-answer");
    }
  },

  waitForIce(pc, timeoutMs) {
    return new Promise((resolve) => {
      if (!pc || pc.iceGatheringState === "complete") {
        resolve();
        return;
      }
      const done = () => {
        pc.removeEventListener("icegatheringstatechange", onChange);
        clearTimeout(timer);
        resolve();
      };
      const onChange = () => {
        if (pc.iceGatheringState === "complete") {
          done();
        }
      };
      const timer = setTimeout(done, Number(timeoutMs) || 2000);
      pc.addEventListener("icegatheringstatechange", onChange);
    });
  },

  setPlaying() {
    this.hasVideo = true;
    this.errorMessage = null;
    this.connecting = false;
    this.logger.log("stream playing");
    this.renderState();
  },

  scheduleReconnect(reason) {
    if (this.suspended) {
      return;
    }
    if (this.reconnectTimer) {
      return;
    }
    const delay = Math.max(1, Number(this.config.reconnectDelay) || 5) * 1000;
    this.logger.warn(`reconnect in ${delay / 1000}s (${reason})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.restart(reason);
    }, delay);
  },

  teardown(reason) {
    this.connecting = false;
    this.hasVideo = false;
    this.generation += 1;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.teardownWebsocket();
    this.teardownPeer();
    this.teardownIframe();
    if (this.video) {
      this.video.srcObject = null;
    }
    this.renderState();
    this.logger.log(`tore down stream (${reason})`);
  },

  teardownIframe() {
    if (!this.iframe) {
      return;
    }
    this.iframe.onload = null;
    this.iframe.onerror = null;
    this.iframe.src = "about:blank";
    if (this.wrapper) {
      this.wrapper.classList.remove("has-iframe");
    }
  },

  teardownPeer() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onconnectionstatechange = null;
      try {
        this.pc.close();
      } catch (e) {
        // already closed
      }
      this.pc = null;
    }
  },

  teardownWebsocket() {
    if (!this.ws) {
      return;
    }
    this.ws.onopen = null;
    this.ws.onmessage = null;
    this.ws.onerror = null;
    this.ws.onclose = null;
    try {
      this.ws.close();
    } catch (e) {
      // already closed
    }
    this.ws = null;
  },

  clearTimers() {
    clearInterval(this.refreshTimer);
    clearTimeout(this.reconnectTimer);
    this.refreshTimer = null;
    this.reconnectTimer = null;
  },

  renderState() {
    if (!this.wrapper) {
      return;
    }
    this.wrapper.classList.toggle("has-video", Boolean(this.hasVideo));
    this.wrapper.classList.toggle("has-iframe", (this.endpoints.signaling || this.config.signaling) === "iframe");
    this.wrapper.classList.toggle("has-error", Boolean(this.errorMessage));
    if (!this.statusEl) {
      return;
    }
    if (this.errorMessage) {
      this.statusEl.textContent = this.errorMessage;
      this.statusEl.classList.add("error");
      return;
    }
    this.statusEl.classList.remove("error");
    if (this.hasVideo) {
      this.statusEl.textContent = "";
      return;
    }
    this.statusEl.textContent = this.connecting ? "Connecting…" : "Waiting for stream";
  }
});

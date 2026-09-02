const NodeHelper = require("node_helper");

try {
  if (typeof Log === "undefined") {
    global.Log = require("logger");
  }
} catch (e) {
  // outside MagicMirror; logger falls back to console
}

const logger = require("./lib/logger");
const { parseAnswer } = require("./lib/sdp");

module.exports = NodeHelper.create({
  start() {
    this.abortByOffer = new Map();
    logger.log("node helper started");
  },

  stop() {
    this.abortByOffer.forEach((controller) => controller.abort());
    this.abortByOffer.clear();
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "OFFER") {
      this.sendWhepOffer(payload);
    }
  },

  async sendWhepOffer(payload) {
    const identifier = payload && payload.identifier;
    const whepUrl = payload && payload.whepUrl;
    const sdp = payload && payload.sdp;
    const offerId = payload && payload.offerId;

    if (!identifier || !whepUrl || !sdp) {
      logger.error("ignoring incomplete WHEP offer");
      return;
    }

    const previous = this.abortByOffer.get(identifier);
    if (previous) {
      previous.abort();
    }
    const controller = new AbortController();
    this.abortByOffer.set(identifier, controller);

    logger.log(`sending WHEP offer for ${identifier} to ${whepUrl}`);

    try {
      const response = await fetch(whepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
          Accept: "application/sdp, application/json, */*"
        },
        body: sdp,
        signal: controller.signal
      });
      const body = await response.text();
      if (!response.ok) {
        throw new Error(`WHEP ${response.status}: ${body.slice(0, 180)}`);
      }
      const answer = parseAnswer(body);
      this.sendSocketNotification(`ANSWER_${identifier}`, { sdp: answer, offerId });
      logger.log(`received WHEP answer for ${identifier}`);
    } catch (err) {
      if (err && err.name === "AbortError") {
        logger.log(`WHEP offer aborted for ${identifier}`);
        return;
      }
      const message = err && err.message ? err.message : String(err);
      logger.error(`WHEP offer failed for ${identifier}: ${message}`);
      this.sendSocketNotification(`ERROR_${identifier}`, { message, offerId });
    } finally {
      if (this.abortByOffer.get(identifier) === controller) {
        this.abortByOffer.delete(identifier);
      }
    }
  }
});

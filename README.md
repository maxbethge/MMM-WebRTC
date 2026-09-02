# MMM-WebRTC

MagicMirror² module that displays a live [WebRTC](https://webrtc.org/) video stream.

Point it at any WebRTC viewer URL, WHEP endpoint, or signaling websocket. The tile has an optional header, configurable size, and a restart timer so a 24/7 mirror can recover from a stalled feed. Logging is prefixed with `MMM-WebRTC`.

## Features

- Live WebRTC playback from a configurable URI
- Optional MagicMirror header (`showHeader: false` hides it even if `header` is set)
- Configurable module width and height
- Minimal padding and borders around the video
- HTML viewer pages (`.html`) load in a borderless iframe
- Native WHEP (SDP offer via `node_helper.js`) or websocket signaling
- Scheduled stream restart and auto-reconnect on failure

## Requirements

- [MagicMirror²](https://magicmirror.builders/) with Node.js 18+
- A WebRTC source reachable from the MagicMirror host (viewer page, WHEP URL, or signaling websocket)
- For peer-to-peer media, the browser must be able to reach the streamer’s ICE candidates (often UDP/TCP on the WebRTC port)

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/maxbethge/MMM-WebRTC
```

There are no npm dependencies. Add a module block to `config/config.js` and restart MagicMirror.

## Configuration

`url` / `uri` is the stream endpoint. Use a full URI, or a base origin plus `camera` (the module appends `viewPath` and `?src=`).

```javascript
{
  module: "MMM-WebRTC",
  position: "top_left",
  header: "Front Door",
  config: {
    url: "http://192.168.1.10:1984/webrtc.html?src=front_door",
    width: 480,
    height: 270,
    refreshInterval: 300
  }
}
```

Base origin plus camera name (default viewer path is `/webrtc.html`):

```javascript
config: {
  url: "http://192.168.1.10:1984",
  camera: "front_door"
}
```

Placeholder in a custom URI:

```javascript
config: {
  url: "http://nvr:8083/stream/{camera}/channel/0/webrtc",
  camera: "front_door",
  signaling: "whep"
}
```

Native WHEP or websocket instead of an HTML viewer:

```javascript
config: {
  url: "http://192.168.1.10:1984",
  camera: "front_door",
  signaling: "whep" // or "websocket"
}
```

Hide the header (must be inside `config`):

```javascript
{
  module: "MMM-WebRTC",
  header: "Front Door",
  config: {
    url: "http://192.168.1.10:1984",
    camera: "front_door",
    showHeader: false
  }
}
```

| Option | Default | Description |
| --- | --- | --- |
| `url` | `null` | Stream URI or base origin. A base origin plus `camera` becomes `{url}{viewPath}?src={camera}` |
| `uri` | `null` | Alias for `url` |
| `camera` | `null` | Stream name. Substituted for `{camera}` / `{src}`, and appended as `src` when `appendCamera` is true |
| `viewPath` | `"/webrtc.html"` | Path joined onto a base origin for an HTML viewer page |
| `webrtcUrl` | `null` | Overrides `url` |
| `wsUrl` | `null` | Explicit signaling WebSocket URL for `signaling: "websocket"` |
| `whepPath` | `"/api/webrtc"` | WHEP path used when `signaling` is `"whep"` |
| `wsPath` | `"/api/ws"` | Websocket path used when `signaling` is `"websocket"` |
| `srcParam` | `"src"` | Query parameter used when appending `camera` |
| `appendCamera` | `true` | Set `false` to leave the URI’s query string unchanged |
| `signaling` | `"auto"` | `"auto"` iframes `.html` viewers; `"whep"` posts SDP via `node_helper.js`; `"websocket"` uses `wsUrl` |
| `header` | `null` | Optional title. The MagicMirror `header` field on the module block also works |
| `showHeader` | `true` | Set `false` **inside `config`** to hide the header even if MagicMirror `header` is set |
| `width` | `"100%"` | Module width. A number is pixels (`480` → `480px`); CSS strings like `"50%"` also work |
| `height` | `"auto"` | Stream viewport height. A number is pixels. `auto` sizes to the video aspect ratio |
| `objectFit` | `"contain"` | How the stream fills a fixed `height`: `contain` shows the full frame; `cover` fills and crops |
| `muted` | `true` | Keep muted so autoplay is allowed |
| `audio` | `false` | Subscribe to the audio transceiver |
| `controls` | `false` | Native video controls |
| `refreshInterval` | `0` | Seconds between a full stream restart. `0` disables the timer |
| `reconnectDelay` | `5` | Seconds to wait after a failed or dropped connection |
| `iceTimeout` | `2000` | Max ms to wait for ICE gathering before sending a WHEP offer |
| `stunServers` | Google STUN | `iceServers` URLs passed to `RTCPeerConnection` |

Send a `MMM_WEBRTC_RESTART` notification (optional `payload.camera`) to restart from another module.

## Layout

`width` and `height` size the module (the stream viewport). An optional header sits above that box and does not change the video height. Numbers are treated as pixels.

```javascript
config: {
  url: "http://192.168.1.10:1984/webrtc.html?src=front_door",
  width: 480,
  height: 270,
  objectFit: "cover",
  showHeader: false
}
```

## Using with Frigate

[Frigate](https://frigate.video/) restreams cameras through bundled [go2rtc](https://github.com/AlexxIT/go2rtc). The go2rtc WebRTC viewer is:

`http://{ip-address}:1984/webrtc.html?src={camera}`

```javascript
config: {
  url: "http://192.168.1.10:1984",
  camera: "front_door"
}
```

That becomes `http://192.168.1.10:1984/webrtc.html?src=front_door`. You can also set that URI in full.

Enable go2rtc streams in Frigate and expose WebRTC to the MagicMirror host:

- go2rtc API / viewer: port **1984**
- WebRTC media: TCP/UDP **8555**
- ICE candidates in `go2rtc.webrtc.candidates` for LAN playback

```yaml
go2rtc:
  streams:
    front_door:
      - rtsp://user:pass@192.168.1.20:554/stream1
      - ffmpeg:front_door#audio=opus
  webrtc:
    candidates:
      - 192.168.1.10:8555
      - stun:8555
```

Map `1984` and `8555` on the Frigate container. If go2rtc rejects the MagicMirror origin, set `api.origin: "*"` in go2rtc.

Native WHEP / websocket against the same go2rtc instance:

```javascript
config: {
  url: "http://192.168.1.10:1984",
  camera: "front_door",
  signaling: "whep" // or "websocket"
}
```

Frigate UI live-proxy paths (`/live/webrtc/...`) are opt-in via `viewPath`, `whepPath`, and `wsPath` if you are not using port 1984.

## Logging

Browser and node helper logs are prefixed with `MMM-WebRTC`, for example:

```text
MMM-WebRTC: starting camera=front_door signaling=iframe size=480pxx270px uri=http://192.168.1.10:1984/webrtc.html?src=front_door
MMM-WebRTC: connecting via iframe (startup)
```

## Development

```bash
npm test
```

Open `preview/index.html` to check header on/off, module sizes, and the zero-gap video layout without MagicMirror.

# MMM-WebRTC

MagicMirror² module that shows a live [Frigate](https://frigate.video/) camera over WebRTC (via the bundled [go2rtc](https://github.com/AlexxIT/go2rtc) restream).

The player loads Frigate’s go2rtc viewer at `http://{ip}:1984/webrtc.html?src={camera}` by default (full-bleed `<video>` inside a borderless iframe). You can instead pass any other WebRTC URI, or use native WHEP / websocket signaling. A header is optional. The stream can be torn down and rebuilt on a timer so a 24/7 mirror recovers from stalled feeds.

## Features

- WebRTC live view from Frigate / go2rtc (`webrtc.html` by default)
- Optional MagicMirror header
- Configurable stream restart interval
- Minimal padding, borders, and letterbox around the video
- Optional native WHEP or websocket signaling for non-viewer URLs
- Auto-reconnect on ICE/connection failure
- All log lines include the `MMM-WebRTC` module name

## Requirements

- [MagicMirror²](https://magicmirror.builders/) with Node.js 18+
- Frigate with go2rtc streams configured for the camera you want to show
- WebRTC reachable from the mirror host:
  - go2rtc API: port **1984** (recommended)
  - WebRTC media: TCP/UDP **8555**
  - ICE candidates listed in Frigate’s `go2rtc.webrtc.candidates` for LAN playback

Example Frigate snippet:

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

## Installation

```bash
cd ~/MagicMirror/modules
git clone https://github.com/maxbethge/MMM-WebRTC
```

There are no npm dependencies. Add a module block to `config/config.js` and restart MagicMirror.

## Configuration

Omit `header` (or set `showHeader: false`) for a borderless video-only tile.

`url` / `uri` is the stream endpoint. The default Frigate/go2rtc viewer is:

`http://{ip-address}:1984/webrtc.html?src={camera}`

```javascript
{
  module: "MMM-WebRTC",
  position: "top_left",
  header: "Front Door",
  config: {
    url: "http://192.168.1.10:1984",
    camera: "front_door",
    width: 480,
    height: 270,
    refreshInterval: 300
  }
}
```

That base origin plus camera name becomes `http://192.168.1.10:1984/webrtc.html?src=front_door`. You can also set the full URI yourself:

```javascript
config: {
  url: "http://192.168.1.10:1984/webrtc.html?src=front_door"
}
```

Custom URI with a `{camera}` placeholder:

```javascript
config: {
  url: "http://nvr:8083/stream/{camera}/channel/0/webrtc",
  camera: "front_door",
  signaling: "whep"
}
```

Native WHEP / websocket (no `webrtc.html` iframe):

```javascript
config: {
  url: "http://192.168.1.10:1984",
  camera: "front_door",
  signaling: "whep" // or "websocket"
}
```

| Option | Default | Description |
| --- | --- | --- |
| `url` | `null` | Stream URI or base origin. A base origin plus `camera` becomes `http://{host}:1984/webrtc.html?src={camera}` |
| `uri` | `null` | Alias for `url` |
| `camera` | `null` | Stream name. Substituted for `{camera}` / `{src}`, and appended as `src` when `appendCamera` is true |
| `viewPath` | `"/webrtc.html"` | Path joined onto a base origin for the go2rtc viewer page |
| `webrtcUrl` | `null` | Overrides `url` |
| `wsUrl` | `null` | Explicit signaling WebSocket URL for `signaling: "websocket"` |
| `whepPath` | `"/api/webrtc"` | WHEP path used when `signaling` is `"whep"` |
| `wsPath` | `"/api/ws"` | Websocket path used when `signaling` is `"websocket"` |
| `srcParam` | `"src"` | Query parameter used when appending `camera` |
| `appendCamera` | `true` | Set `false` to leave the URI’s query string unchanged |
| `signaling` | `"auto"` | `"auto"` iframes `webrtc.html` (and other `.html` viewers), `"whep"` posts SDP via `node_helper.js`, `"websocket"` uses `wsUrl` |
| `header` | `null` | Optional title. The MagicMirror `header` field on the module block also works |
| `showHeader` | `true` | Set `false` to hide the header even if one is configured |
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

## Logging

Browser and node helper logs are prefixed with `MMM-WebRTC`, for example:

```text
MMM-WebRTC: starting camera=front_door signaling=whep
MMM-WebRTC: sending WHEP offer for MMM-WebRTC_1 to http://192.168.1.10:1984/api/webrtc?src=front_door
```

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

## Development

```bash
npm test
```

Open `preview/index.html` to check header on/off, module sizes, and the zero-gap video layout without MagicMirror.

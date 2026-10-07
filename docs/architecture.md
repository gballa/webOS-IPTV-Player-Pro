# LG webOS IPTV Player Pro — Architectural Specification

## 1. Overview & Baseline Compatibility

webOS IPTV Player Pro is engineered from the ground up for the 10-foot living room experience across LG webOS TV versions:
- **Baseline Target**: LG webOS 4.0 (Chromium 53 runtime, 1.0GB–1.5GB RAM, dual-core SoC)
- **High-End Target**: LG webOS 5, 6, 22, 23, 24, 25, 26 (4K OLED, Alpha 9/11 AI Gen SoCs)
- **Installation Formats**: Self-contained `.ipk` package installable via **webOS Developer Mode**, **webOS Dev Manager**, or **Homebrew Channel**.

---

## 2. Playback Pipeline & User-Selectable Engine Strategy

The player defaults to the **Native HTML5 hardware media pipeline** for optimal 4K HDR10, Dolby Vision, and Dolby Atmos passthrough with minimum CPU usage. Users can select any of the 5 playback modes in **Settings → Playback → Player Engine**:

| Engine | Mechanism | When to Prefer | Hardware Integration |
|:-------|:----------|:---------------|:---------------------|
| **Native (Default)** | Direct `video.src = url` | Most live broadcasts & VOD | Directly offloaded to webOS hardware video decoders; lowest CPU (< 5%); native HDR10/Dolby Vision/Atmos eARC passthrough. |
| **Auto** | Protocol probe & auto-select | Intelligent hands-free playback | Probes stream headers; selects Native for standard HLS/MP4, mpegts.js for raw HTTP-TS, and Shaka for DASH/DRM. |
| **hls.js** | MSE JavaScript demuxer | Complex HLS & alternate audio | On-demand MSE buffering for complex multi-audio manifests and Low-Latency HLS. |
| **mpegts.js** | HTTP-TS demuxer | Raw MPEG-TS over HTTP | Demuxes `.ts` transport stream packets into ISO BMFF FMP4 segments on-the-fly. |
| **Shaka Player** | EME / DASH client | MPEG-DASH manifests & DRM | Dynamically loaded on demand for `.mpd` manifests, ClearKey, and Widevine DRM. |

All engines share the exact same custom 10-foot OSD, audio track selector, subtitle track selector, live DVR scrubber, and stall watchdog.

```
                    [Incoming Stream URL]
                              │
               [User Engine Preference Check]
             (Native / Auto / hls / mpegts / shaka)
                              │
                 ┌────────────┴────────────┐
                 ▼                         ▼
        [Native Engine]            [Specialist MSE Engine]
         Direct video.src          (hls.js / mpegts / Shaka)
                 │                         │
                 └────────────┬────────────┘
                              ▼
                   [Unified 10-Foot OSD]
                              │
                    [Stall Watchdog Active]
                              │
                     ┌────────┴────────┐
              Stall > 3.5s        Normal 60fps
                     │
            [Step 1: Soft Nudge (+0.5s)]
                     │
            [Step 2: Engine Hot-Swap]
                     │
            [Step 3: Hard Stream Reload]
                     │
            [Step 4: Auto-Tune Next Channel]
```

---

## 3. UI / UX Design Tokens & Customisability

The UI is built with a strict 10-foot design system:

### Base Themes
- **Dark Obsidian (Default)**: Balanced dark palette for home viewing.
- **Midnight Black (OLED Pure `#000000`)**: Complete pixel shut-off for OLED panels, eliminating burn-in and halo effects.
- **Soft Charcoal Dark**: Warm slate-gray tones gentle on the eyes.
- **High Contrast Daytime**: Clean, bright presentation for sunlit rooms.

### Accent Glow Colors
Users can select from 8 accents with instant live preview:
`Teal (#00d2ff)`, `Gold (#f59e0b)`, `Purple (#a855f7)`, `Ocean Blue (#3b82f6)`, `Coral (#f97316)`, `Emerald (#10b981)`, `Ruby (#ef4444)`, and `Electric Cyan (#06b6d4)`.

### Spacing & Density
- **Comfortable**: Generous spacing, large channel logos, ideal for 65"+ viewing distances.
- **Compact**: Tighter spacing, displaying more channels and program schedule at a glance.

### Typography Scaling
Text size is adjustable from **85% to 150%** via CSS custom property `--tv-font-scale`. Control dimensions stay fixed to preserve D-pad targeting accuracy.

---

## 4. Remote Control & Spatial Navigation

The application interfaces directly with LG Magic Remote pointer, D-pad, and TV hardware keys:

| Remote Button | Player Action | Channel List | EPG Grid |
|:--------------|:--------------|:-------------|:---------|
| **Up / Down** | Previous / Next Channel | Navigate List | Navigate Channels |
| **Left / Right** | DVR Seek -10s / +10s | Switch Groups ↔ List | Navigate Timeline |
| **OK / Select** | Toggle OSD / Play-Pause | Tune Fullscreen | Play / Catch-Up |
| **Back / Return** | Close Overlays → Exit | Exit to Live | Return to Live |
| **🔴 Red Button** | Jump to EPG Guide | Open EPG Guide | Return to Live |
| **🟢 Green Button** | Toggle Favorite | Toggle Favorite | Jump to Live Now |
| **🟡 Yellow Button** | Global Search Modal | Global Search Modal | Search Schedule |
| **🔵 Blue Button** | Open Settings | Open Settings | Open Settings |
| **0 – 9 Numbers** | Direct Channel Dialing | Direct Channel Dialing | — |
| **Channel Up / Down** | Channel Step ±1 | Page Scroll | Page Scroll |

---

## 5. Memory Model & Web Workers

- **`playlist-worker.ts`**: Asynchronously parses massive M3U catalogs (50,000+ channels) with chunked progress reporting, preventing UI thread blocking.
- **`epg-worker.ts`**: Indexes XMLTV schedule data with strict time-window boundaries `[Now - 2h, Now + 6h]` to keep RAM consumption under 35MB on older webOS 4 hardware.
- **Virtualization**: The `VirtualList` component ensures only ~15 DOM nodes are in the layout tree at any given moment.

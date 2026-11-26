# Changelog

## 1.12.1 — 2026-11-25

- Fix: the date button's text was black on dark themes.
- The card editor opens Home Assistant's code editor instead of a read-only help panel.
- Blueprint: no duplicate events when UniFi Protect reloads; dropped face and license plate (the card has no icon for them).
- README: screenshots, clearer calendar setup, smart-detection requirement.

## 1.12.0 — 2026-11-25

First public release, named UniFi Protect Events Card. The card type stays `custom:camera-events-card`.

- New `person_entities` option. Arrival/departure context uses every `person.*` entity by default.
- Full-frame snapshots find UniFi Protect's `<Camera> High resolution channel` entity automatically.
- Icons and colours for animal and package detections.
- Blueprint that logs UniFi Protect detections to a calendar.

Earlier versions were private; their notes are in the header of `camera-events-card.js`.

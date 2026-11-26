# Changelog

## 1.13.0 — 2026-11-26

Blueprint only; the card is unchanged. Re-import the blueprint to get it. Existing automations keep working, with every new option off.

- Optional phone alerts through the Companion app: camera name, thumbnail, and a dashboard to open on tap. Optional cooldown per camera.
- Optional grouping: detections within a quiet period of the last alert are logged under it (`path_grouping`) and send no alert.
- Optional household arrival: detections shortly after a chosen person comes home are logged as `person_arrival` and send no alert.
- Doorbell rings are always an alert.
- Needs Home Assistant 2024.10 or later.

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

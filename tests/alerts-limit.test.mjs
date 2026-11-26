'use strict';

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const registry = new Map();
const storage = new Map();

global.HTMLElement = class {
  attachShadow() {
    this.shadowRoot = {
      innerHTML: '',
      querySelector: () => null,
      querySelectorAll: () => [],
    };
  }
};
global.window = {
  addEventListener: () => {},
  removeEventListener: () => {},
  customCards: [],
};
global.document = { createElement: () => ({}) };
global.requestAnimationFrame = (callback) => callback();
global.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
global.customElements = {
  define: (name, constructor) => registry.set(name, constructor),
};

const source = fs.readFileSync(new URL('../camera-events-card.js', import.meta.url), 'utf8');
vm.runInThisContext(source, { filename: 'camera-events-card.js' });
const CameraEventsCard = registry.get('camera-events-card');

function calendarEvent(timestamp, status, eventId) {
  return {
    start: { dateTime: timestamp },
    end: { dateTime: timestamp },
    summary: 'Person',
    description: `Status: ${status}\nCamera: Driveway\nDetection: person\nTime: ${timestamp.slice(11, 19)}\nPath: driveway\nLeadTime: ${timestamp}`,
    location: `/api/unifiprotect/thumbnail/nvr/${eventId},Driveway`,
    uid: eventId,
  };
}

async function main() {
  const events = [];
  for (let minute = 59; minute >= 15; minute -= 1) {
    events.push(calendarEvent(`2026-09-10T17:${String(minute).padStart(2, '0')}:00-04:00`, 'SUPPRESSED', `suppressed-${minute}`));
  }
  for (let minute = 10; minute >= 6; minute -= 1) {
    events.push(calendarEvent(`2026-09-10T15:${String(minute).padStart(2, '0')}:00-04:00`, 'LEAD', `lead-${minute}`));
  }

  const card = new CameraEventsCard();
  card.setConfig({ calendar_entity: 'calendar.camera_events', max_events: 40, default_view_mode: 'alerts' });
  card._hass = {
    callApi: async () => ({
      service_response: {
        'calendar.camera_events': { events },
      },
    }),
  };
  card._fetchPersonHistory = async () => [];
  card._computePersonContexts = () => {};
  card._render = () => {};

  await card._loadEvents();

  assert.equal(card._viewMode, 'alerts');
  assert.equal(card._getDisplayedGroups().length, 5,
    'Alerts must be limited after status filtering, not displaced by newer suppressed events');
  assert.equal(card._getDisplayedGroups()[0].header.status, 'lead');
  console.log('PASS: older lead events survive a newer suppressed-event flood');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

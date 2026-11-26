const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function load() {
  let Card;
  const context = {HTMLElement: class {}, window: {}, console: {info() {}},
    customElements: {define(name, cls) { if (name === 'camera-events-card') Card = cls; }},
    document: {createElement() { return {}; }}, encodeURIComponent};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'camera-events-card.js'), 'utf8'), context);
  return Card;
}
const Card = load();
const states = {
  'person.alex': {attributes: {friendly_name: 'Alex Smith'}},
  'person.sam_lee': {attributes: {}},
  'camera.driveway': {attributes: {}},
};
function card(config) {
  const c = Object.create(Card.prototype);
  c._hass = {states}; c._config = config;
  return c;
}

test('defaults to every person entity', () => {
  assert.deepEqual([...card({})._personEntities()], ['person.alex', 'person.sam_lee']);
});
test('honours an explicit list and false', () => {
  assert.deepEqual([...card({person_entities: ['person.alex', 'light.x']})._personEntities()], ['person.alex']);
  assert.deepEqual([...card({person_entities: false})._personEntities()], []);
});
test('display name is the first word of the friendly name', () => {
  assert.equal(card({})._personDisplayName('person.alex'), 'Alex');
  assert.equal(card({})._personDisplayName('person.sam_lee'), 'Sam');
});
test('no history request when there are no people', async () => {
  const c = card({person_entities: false});
  c._startDate = new Date(); c._endDate = new Date();
  c._hass.fetchWithAuth = () => { throw new Error('should not fetch'); };
  assert.deepEqual([...await c._fetchPersonHistory()], []);
});

test('full-frame lookup prefers the high resolution channel and skips package cameras', () => {
  const c = Object.create(Card.prototype);
  c._config = {};
  c._hass = {states: {
    'camera.front_package_camera': {state: 'idle', attributes: {friendly_name: 'Front Package camera'}},
    'camera.front_medium': {state: 'idle', attributes: {friendly_name: 'Front Medium resolution channel'}},
    'camera.front_high': {state: 'recording', attributes: {friendly_name: 'Front High resolution channel'}},
    'camera.front_yard_high': {state: 'recording', attributes: {friendly_name: 'Front Yard High resolution channel'}},
  }};
  assert.equal(c._findCameraEntityId('Front'), 'camera.front_high');
  assert.equal(c._findCameraEntityId('Front Yard'), 'camera.front_yard_high');
  assert.equal(c._findCameraEntityId('Back'), null);
  c._config = {camera_entities: {Front: 'camera.front_medium'}};
  assert.equal(c._findCameraEntityId('Front'), 'camera.front_medium');
});

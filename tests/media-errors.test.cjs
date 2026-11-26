const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function setup(fetch) {
  let Card, created = 0, revoked = [];
  const context = {HTMLElement: class {}, window: {removeEventListener() {}}, console: {info() {}},
    customElements: {define(name, cls) {if (name === 'camera-events-card') Card = cls;}},
    URL: {createObjectURL() {return `blob:test-${++created}`;}, revokeObjectURL(u) {revoked.push(u);}},
    document: {createElement(tag) {return {tag, style: {}, setAttribute() {}, classList: {remove() {}}, remove() {}};}},
    encodeURIComponent, setTimeout, clearInterval};
  vm.runInNewContext(fs.readFileSync(process.env.CARD_SOURCE || path.join(__dirname, '..', 'camera-events-card.js'), 'utf8'), context);
  const card = Object.create(Card.prototype);
  card._hass = {fetchWithAuth: fetch, states: {}};
  card._config = {}; card._thumbnailCache = new Map(); card._snapshotCache = new Map(); card._videoCache = new Map();
  card.shadowRoot = {querySelector() {return null;}};
  return {card, revoked};
}
const ok = () => ({ok: true, status: 200, blob: async () => ({type: 'image/jpeg', size: 12})});
for (const [status, expected] of [[401, /Authentication.*401/], [403, /Access denied.*403/], [404, /Image not found.*404/], [500, /Server error.*500/], [502, /Server error.*502/]]) {
  test(`HTTP ${status} is explained without caching a failure`, async () => {
    const {card} = setup(async () => ({ok: false, status}));
    assert.equal(await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a'), null);
    assert.equal(card._thumbnailCache.size, 0);
    assert.match(card._getMediaError(card._thumbnailCache, 'a'), expected);
  });
}
for (const [name, error, expected] of [['network', new TypeError('secret network URL'), /Network/], ['auth refresh', {code: 'auth.invalid', message: 'secret token'}, /Authentication/], ['unknown refresh exception', new Error('secret refresh body'), /Request failed/]]) {
  test(`${name} is safe and useful`, async () => {
    const {card} = setup(async () => {throw error;});
    await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a');
    const message = card._getMediaError(card._thumbnailCache, 'a');
    assert.match(message, expected); assert.doesNotMatch(message, /secret/);
  });
}
test('successful cache is reused; explicit retry recovers only the failure', async () => {
  let calls = 0;
  const {card} = setup(async () => ++calls === 1 ? {ok: false, status: 401} : ok());
  card._snapshotCache.set('a', 'blob:working');
  assert.equal(await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a'), null);
  const recovered = await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a');
  assert.equal(recovered, 'blob:test-1');
  assert.equal(card._getMediaError(card._thumbnailCache, 'a'), null);
  assert.equal(await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a'), recovered);
  assert.equal(card._snapshotCache.get('a'), 'blob:working'); assert.equal(calls, 2);
});
for (const blob of [{type: 'text/html', size: 12}, {type: 'image/jpeg', size: 0}]) {
  test(`invalid image ${blob.type}/${blob.size} is not cached`, async () => {
    const {card} = setup(async () => ({ok: true, blob: async () => blob}));
    assert.equal(await card._fetchWithAuth('/api/image', card._thumbnailCache, 'a'), null);
    assert.match(card._getMediaError(card._thumbnailCache, 'a'), /image|empty/i);
    assert.equal(card._thumbnailCache.size, 0);
  });
}
test('simultaneous requests reuse one fetch and blob', async () => {
  let calls = 0; const releases = [];
  const {card} = setup(() => {calls++; return new Promise(resolve => {releases.push(resolve);});});
  const first = card._fetchWithAuth('/api/image', card._thumbnailCache, 'a');
  const second = card._fetchWithAuth('/api/image', card._thumbnailCache, 'a');
  releases.forEach(release => release(ok()));
  assert.deepEqual(await Promise.all([first, second]), ['blob:test-1', 'blob:test-1']); assert.equal(calls, 1);
});
function container() {
  return {isConnected: true, children: [], textContent: '', replaceChildren(...nodes) {this.children = nodes; this.textContent = '';}};
}
for (const kind of ['thumbnail', 'snapshot']) {
  test(`${kind} popup error has one retry button and recovers`, async () => {
    let calls = 0;
    const {card} = setup(async () => ++calls === 1 ? {ok: false, status: 404} : ok());
    card._findCameraEntityId = () => 'camera.driveway';
    const el = container(); const event = {event_id: 'a', nvr_id: 'entry', camera_friendly: 'Driveway', timestamp: '2026-10-06T12:00:00-04:00', thumbnail_url: '/api/thumbnail'};
    await card._loadPopupImage(event, el, kind);
    assert.match(el.children[0].textContent, /404/);
    const button = el.children[1]; assert.equal(button.textContent, 'Retry');
    const retry = button.onclick(); const duplicate = button.onclick();
    await Promise.all([retry, duplicate]);
    assert.equal(calls, 2); assert.equal(el.children.length, 1); assert.equal(el.children[0].tag, 'img');
  });
}
test('missing camera mapping is explained, without a network request', async () => {
  const {card} = setup(() => {throw new Error('must not fetch');});
  card._findCameraEntityId = () => null;
  const el = container(); await card._loadPopupImage({event_id: 'a'}, el, 'snapshot');
  assert.match(el.children[0].textContent, /camera entity/i);
});
test('cached popup image makes no request and closed popup stays untouched', async () => {
  const {card} = setup(() => {throw new Error('must not fetch');});
  card._thumbnailCache.set('a', 'blob:existing');
  const el = container(); await card._loadPopupImage({event_id: 'a'}, el, 'thumbnail');
  assert.equal(el.children[0].src, 'blob:existing');
  el.isConnected = false; el.replaceChildren();
  await card._loadPopupImage({event_id: 'a'}, el, 'thumbnail'); assert.equal(el.children.length, 0);
});
test('existing cleanup still revokes all successful blobs', () => {
  const {card, revoked} = setup(ok); card._boundResizeHandler = () => {};
  card._thumbnailCache.set('a', 'blob:thumb'); card._snapshotCache.set('a', 'blob:snapshot'); card._videoCache.set('a', 'blob:video');
  card.disconnectedCallback();
  assert.deepEqual(revoked, ['blob:thumb', 'blob:snapshot', 'blob:video']);
  assert.equal(card._thumbnailCache.size + card._snapshotCache.size + card._videoCache.size, 0);
});
test('a pending download cannot recreate blob caches after disconnect', async () => {
  let release;
  const {card} = setup(() => new Promise(resolve => {release = resolve;}));
  const request = card._fetchWithAuth('/api/image', card._thumbnailCache, 'a');
  card.disconnectedCallback(); release(ok());
  assert.equal(await request, null); assert.equal(card._thumbnailCache.size, 0);
});
test('snapshot request retains the original leading API path and encoded timestamp', async () => {
  let requested;
  const {card} = setup(async url => {requested = url; return ok();});
  card._findCameraEntityId = () => 'camera.driveway';
  await card._loadPopupImage({event_id:'a', nvr_id:'entry', timestamp:'2026-10-06T12:00:00-04:00'}, container(), 'snapshot');
  assert.equal(requested, '/api/unifiprotect/snapshot/entry/camera.driveway/2026-10-06T12%3A00%3A00-04%3A00?width=1280');
});
test('video still accepts its existing blob response type', async () => {
  const {card} = setup(async () => ({ok:true, blob:async () => ({type:'video/mp4',size:12})}));
  assert.equal(await card._fetchWithAuth('/api/video', card._videoCache, 'video_a'), 'blob:test-1');
});

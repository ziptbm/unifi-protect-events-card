/**
 * UniFi Protect Events Card - Custom Lovelace Card (type: custom:camera-events-card)
 *
 * Config:
 *   type: custom:camera-events-card
 *   calendar_entity: calendar.camera_events
 *   max_events: 200
 *   default_view_mode: alerts
 *   camera_entities:
 *     Driveway: camera.driveway_high_resolution_channel
 *   person_entities:          # optional; default = every person.* entity, false = off
 *     - person.alex
 *
 * Version: 1.12.1
 * Last Updated: 2026-11-25
 *
 * Changes in 1.12.1:
 * - Fix: date button text was black on dark themes
 * - The card editor now opens Home Assistant's code editor instead of a
 *   read-only help panel
 *
 * Changes in 1.12.0:
 * - First public release, as UniFi Protect Events Card
 * - Icons and colours for animal and package detections
 * - Full-frame lookup falls back to UniFi Protect's "<Camera> High resolution
 *   channel" naming, so camera_entities is rarely needed
 * - New person_entities option for arrival/departure context
 *   (default: every person.* entity)
 *
 * Changes in 1.11.3:
 * - Show safe media-download errors and per-image retry in the popup
 * - Preserve working caches and share simultaneous media requests
 *
 * Changes in 1.11.2:
 * - Fix: Apply max_events after view-mode filtering so suppressed-event floods
 *   cannot displace every visible alert
 *
 * Changes in 1.11.1:
 * - Fix: Resolve full-frame cameras through an explicit event-name map first
 * - Fix: Fall back to normalized friendly-name matching (ignores a trailing "Camera")
 * - Fix: Replace the permanent loading spinner with "Full frame unavailable" on failure
 *
 * Changes in 1.11.0:
 * - Feature: Dual-image popup (detection crop + full frame)
 *   - Shows cropped thumbnail (360x360 detection zone) at top
 *   - Loads full-frame snapshot (1280px) below for context
 *   - Progressive loading: thumbnail shown immediately, snapshot loads in background
 *   - List view thumbnails unchanged (small/fast)
 *
 * Changes in 1.10.7:
 * - Feature: Doorbell detection type support
 *   - New icon: mdi:doorbell with teal color (#009688)
 *   - Appears in Type filter dropdown when doorbell events exist
 *   - Doorbell events are always LEAD (user-initiated, never suppressed)
 *
 * Changes in 1.10.6:
 * - Style: Alerts dropdown uses orange/gold gradient when selected
 *   - Matches LEAD badge styling for visual consistency
 *
 * Changes in 1.10.5:
 * - Feature: Type filter dropdown (All Types / Person / Vehicle)
 *   - Third dropdown alongside view mode and camera filter
 *   - Filters combine with camera filter (AND condition)
 *   - Selection persists via localStorage
 *
 * Changes in 1.10.4:
 * - Feature: Camera filter dropdown replaces button tabs
 *   - Matches view mode dropdown styling for visual consistency
 *   - Options: "All Cameras" (default) + each camera from event data
 *   - Selection persists via localStorage
 *
 * Changes in 1.10.3:
 * - Feature: Cross-camera merge for same detection type
 *   - Adjacent groups merge when LEADs are ≤3 min apart AND same detection type
 *   - person+person merge, vehicle+vehicle merge
 *   - Different detection types stay separate (person + vehicle = two groups)
 *   - Enables tracking events across property (e.g., person walking Street → Driveway → Front Porch)
 *
 * Changes in 1.10.2:
 * - Feature: Group-level contextual labels replace per-event chips
 *   - Group headers show ONE label derived from children's SuppressReasons
 *   - outdoor_activity → "Outdoor Activity"
 *   - person_arrival → "[Name] Arrival" or "Arrival"
 *   - person_departure → "[Name] Departure" or "Departure"
 *   - vehicle_active (or any *_active reason) → "Vehicle Active"
 *   - Priority: outdoor_activity > arrival > departure > vehicle
 * - Fix: Child events no longer show redundant SuppressReasons chips
 * - Fix: LEAD events in Alerts mode show no label
 *
 * Changes in 1.10.1:
 * - Feature: Merge window for nearby groups in Groups mode
 *   - Adjacent groups with LEAD timestamps ≤3 minutes apart are merged
 *   - Only merges groups from the same camera (or if either has no camera)
 *   - Earlier LEAD becomes header, later LEAD becomes child
 *   - Orphaned suppressed events (no LEAD match) are not merged
 *
 * Changes in 1.10.0:
 * - Feature: 3-mode dropdown replaces Lead/All toggle buttons
 *   - Alerts: Flat list of LEAD events only (what pushed notifications)
 *   - Groups: All events grouped by LeadTime with expand/collapse
 *   - All: Flat chronological list of every event (debug view)
 * - Breaking: localStorage migrates showLeadOnly boolean to viewMode string
 * - Config: default_view_mode replaces default_lead_only (backwards compatible)
 *
 * Changes in 1.9.5:
 * - Style: max-width 800px with auto margins constrains card on wide viewports
 *
 * Changes in 1.9.4:
 * - Fix: Dynamic card height calculated from actual viewport position (min 300px)
 * - Fix: Expanding a group scrolls to reveal hidden children if below visible area
 *
 * Changes in 1.9.3:
 * - Fix: Expand/collapse uses DOM manipulation instead of full re-render (preserves scroll)
 * - Fix: Smart auto-refresh compares events - only scrolls to top on new LEAD events
 *
 * Changes in 1.9.2:
 * - Fix: Scroll position preserved on expand/collapse
 * - Fix: Auto-refresh interval increased to 3 minutes
 * - Fix: Auto-refresh skipped if user interacted in last 2 minutes
 * - Fix: Card height grows when expanding groups (max-height: 80vh)
 *
 * Changes in 1.9.1:
 * - Event grouping by shared LeadTime value
 * - Group headers with "+N" badge showing count of grouped events
 * - Tap group header to expand/collapse children inline
 * - Lead Only mode shows collapsed groups by default
 * - All Events mode shows expanded groups by default
 * - SuppressReasons displayed as colored chips on child events
 *
 * Changes in 1.8.8:
 * - PersonContext shown in popup detail view
 * - Auto-refresh slows to 5 min after Load More (was always 1 min)
 * - Auto-refresh no longer resets scroll position / display limit
 * - Default display limit raised from 20 to 50
 * - Load More increments by 50 instead of 20
 * - Filter button active states now visually consistent
 */

class CameraEventsCard extends HTMLElement {
  static STORAGE_KEY = 'camera-events-card-prefs';

  static COLORS = {
    person: { bg: 'rgba(255, 152, 0, 0.15)', icon: '#ff9800' },
    vehicle: { bg: 'rgba(33, 150, 243, 0.15)', icon: '#2196f3' },
    doorbell: { bg: 'rgba(0, 150, 136, 0.15)', icon: '#009688' },
    animal: { bg: 'rgba(76, 175, 80, 0.15)', icon: '#4caf50' },
    package: { bg: 'rgba(121, 85, 72, 0.15)', icon: '#795548' },
    default: { bg: 'rgba(158, 158, 158, 0.15)', icon: '#9e9e9e' }
  };

  static ICONS = {
    person: 'mdi:walk',
    vehicle: 'mdi:car',
    doorbell: 'mdi:doorbell',
    animal: 'mdi:paw',
    package: 'mdi:package-variant-closed',
    default: 'mdi:cctv'
  };

  static SUPPRESS_REASONS = {
    outdoor_activity: { icon: '🏃', color: '#ff9800', label: 'Outdoor Activity' },
    vehicle_active: { icon: '🚗', color: '#2196f3', label: 'Vehicle Active' },
    path_grouping: { icon: '📍', color: '#4caf50', label: 'Path Grouping' },
    person_arrival: { icon: '🏠', color: '#009688', label: 'Person Arrival' },
    existing_sensor: { icon: '⏸️', color: '#9e9e9e', label: 'Existing Sensor' }
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._events = [];
    this._cameraFilter = 'all';
    this._typeFilter = 'all';
    this._loading = true;
    this._error = null;
    this._initialized = false;
    this._refreshInterval = null;
    this._thumbnailCache = new Map();
    this._snapshotCache = new Map(); // Full-frame snapshots for popup context
    this._videoCache = new Map();
    this._personHistory = [];
    this._personContextMap = new Map();
    this._dateDialogOpen = false;

    // Date range state
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    this._startDate = todayStart;
    this._endDate = now;
    this._datePreset = 'today';

    // Filter state
    this._displayLimit = 50;
    this._viewMode = 'alerts'; // 'alerts', 'groups', or 'all'

    // Group expansion state (set of LeadTime keys that are expanded)
    this._expandedGroups = new Set();

    // Interaction tracking for smart auto-refresh
    this._lastInteractionTime = 0;

    // Previous event IDs for smart refresh comparison
    this._previousLeadEventIds = new Set();

    this._loadPreferences();

    // Bound resize handler for add/remove
    this._boundResizeHandler = this._updateEventsContainerHeight.bind(this);
  }

  connectedCallback() {
    window.addEventListener('resize', this._boundResizeHandler);
  }

  static getStubConfig() {
    return { calendar_entity: 'calendar.camera_events', max_events: 200, default_view_mode: 'alerts' };
  }

  _loadPreferences() {
    try {
      const stored = localStorage.getItem(CameraEventsCard.STORAGE_KEY);
      if (stored) {
        const prefs = JSON.parse(stored);
        // Migrate old boolean showLeadOnly to new viewMode string
        if (typeof prefs.showLeadOnly === 'boolean' && !prefs.viewMode) {
          this._viewMode = prefs.showLeadOnly ? 'alerts' : 'groups';
        } else if (prefs.viewMode && ['alerts', 'groups', 'all'].includes(prefs.viewMode)) {
          this._viewMode = prefs.viewMode;
        }
        if (prefs.datePreset) {
          this._datePreset = prefs.datePreset;
          this._applyDatePreset(prefs.datePreset, false);
        }
        if (prefs.cameraFilter) {
          this._cameraFilter = prefs.cameraFilter;
        }
        if (prefs.typeFilter) {
          this._typeFilter = prefs.typeFilter;
        }
      }
    } catch (e) {}
  }

  _savePreferences() {
    try {
      localStorage.setItem(CameraEventsCard.STORAGE_KEY, JSON.stringify({
        viewMode: this._viewMode,
        datePreset: this._datePreset,
        cameraFilter: this._cameraFilter,
        typeFilter: this._typeFilter
      }));
    } catch (e) {}
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { calendar_entity: 'calendar.camera_events', max_events: 200, default_view_mode: 'alerts', ...config };
    // Backwards compatibility: default_lead_only: true → 'alerts', false → 'groups'
    if (!localStorage.getItem(CameraEventsCard.STORAGE_KEY)) {
      if (this._config.default_view_mode && ['alerts', 'groups', 'all'].includes(this._config.default_view_mode)) {
        this._viewMode = this._config.default_view_mode;
      } else if (typeof this._config.default_lead_only === 'boolean') {
        this._viewMode = this._config.default_lead_only ? 'alerts' : 'groups';
      }
    }
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized && hass) {
      this._initialized = true;
      this._loadEvents();
      this._setRefreshInterval(180000); // 3 minutes
    }
  }

  _setRefreshInterval(ms) {
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    this._refreshInterval = setInterval(() => {
      // Skip refresh if user interacted in the last 2 minutes
      const now = Date.now();
      if (now - this._lastInteractionTime < 120000) return;
      this._loadEvents(false);
    }, ms);
  }

  disconnectedCallback() {
    this._mediaGeneration = (this._mediaGeneration || 0) + 1;
    this._mediaStates = new WeakMap();
    if (this._refreshInterval) { clearInterval(this._refreshInterval); this._refreshInterval = null; }
    window.removeEventListener('resize', this._boundResizeHandler);
    this._thumbnailCache.forEach(url => URL.revokeObjectURL(url));
    this._thumbnailCache.clear();
    this._snapshotCache.forEach(url => URL.revokeObjectURL(url));
    this._snapshotCache.clear();
    this._videoCache.forEach(url => URL.revokeObjectURL(url));
    this._videoCache.clear();
  }

  /**
   * Calculate and set dynamic height for .events container based on its viewport position.
   * Uses getBoundingClientRect() to measure actual position, accounts for HA sidebar/topbar/other cards.
   */
  _updateEventsContainerHeight() {
    const eventsContainer = this.shadowRoot?.querySelector('.events');
    if (!eventsContainer) return;

    const rect = eventsContainer.getBoundingClientRect();
    const availableHeight = window.innerHeight - rect.top - 40; // 40px bottom padding
    const finalHeight = Math.max(300, availableHeight); // Minimum 300px
    eventsContainer.style.maxHeight = `${finalHeight}px`;
  }

  _mediaState(cacheMap) {
    this._mediaStates ||= new WeakMap();
    if (!this._mediaStates.has(cacheMap)) {
      this._mediaStates.set(cacheMap, {errors: new Map(), requests: new Map()});
    }
    return this._mediaStates.get(cacheMap);
  }

  _getMediaError(cacheMap, cacheKey) {
    return this._mediaState(cacheMap).errors.get(cacheKey) || null;
  }

  async _fetchWithAuth(url, cacheMap, cacheKey) {
    if (cacheMap.has(cacheKey)) return cacheMap.get(cacheKey);
    const state = this._mediaState(cacheMap);
    if (state.requests.has(cacheKey)) return state.requests.get(cacheKey);
    const generation = this._mediaGeneration || 0;
    const request = (async () => {
      state.errors.delete(cacheKey);
      try {
        const response = await this._hass.fetchWithAuth(url);
        if (!response.ok) {
          const status = response.status;
          const message = status === 401 ? 'Authentication required' :
            status === 403 ? 'Access denied' : status === 404 ? 'Image not found' :
            status >= 500 ? 'Server error' : 'Download failed';
          state.errors.set(cacheKey, `${message} (HTTP ${status}).`);
          return null;
        }
        const blob = await response.blob();
        // Do not cache an HTML error/login page as a working image. Video is unchanged.
        if (cacheMap !== this._videoCache && (!blob.size || !blob.type.startsWith('image/'))) {
          state.errors.set(cacheKey, !blob.size ? 'The image response was empty.' : 'The server did not return an image.');
          return null;
        }
        if (generation !== (this._mediaGeneration || 0)) return null;
        const blobUrl = URL.createObjectURL(blob);
        cacheMap.set(cacheKey, blobUrl);
        return blobUrl;
      } catch (e) {
        // Never expose exception messages, request headers, tokens, or response bodies.
        const code = e?.code || e?.error || e;
        const authFailure = ['auth.invalid', 'auth.expired', 'invalid_auth', 'invalid_grant'].includes(code);
        state.errors.set(cacheKey, authFailure ? 'Authentication failed before the download.' :
          e?.name === 'TypeError' ? 'Network request failed. Check the connection and retry.' :
          'Request failed before the image downloaded (authentication refresh or connection).');
        return null;
      }
    })();
    state.requests.set(cacheKey, request);
    try { return await request; }
    finally { state.requests.delete(cacheKey); }
  }

  async _loadPopupImage(event, container, kind) {
    if (!container?.isConnected) return;
    const thumbnail = kind === 'thumbnail';
    const cache = thumbnail ? this._thumbnailCache : this._snapshotCache;
    let url = event.thumbnail_url;
    let missingCamera = false;
    if (!thumbnail && !cache.has(event.event_id)) {
      const entity = this._findCameraEntityId(event.camera_friendly);
      missingCamera = !entity;
      url = entity ? `/api/unifiprotect/snapshot/${event.nvr_id}/${encodeURIComponent(entity)}/${encodeURIComponent(event.timestamp)}?width=1280` : null;
    }
    container.textContent = 'Loading...';
    const blobUrl = missingCamera ? null : await this._fetchWithAuth(url, cache, event.event_id);
    if (!container.isConnected) return;
    if (blobUrl) {
      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = thumbnail ? 'Detection thumbnail' : 'Full frame';
      img.className = thumbnail ? 'popup-thumb' : 'popup-snapshot';
      container.replaceChildren(img);
      if (thumbnail) {
        const listImage = this.shadowRoot.querySelector(`img[data-event-id="${event.event_id}"]`);
        if (listImage) { listImage.src = blobUrl; listImage.style.opacity = '1'; }
      }
    } else {
      const message = document.createElement('div');
      message.className = 'popup-media-error';
      message.setAttribute('role', 'status');
      message.textContent = missingCamera ? 'Full frame unavailable: no matching camera entity.' :
        this._getMediaError(cache, event.event_id) || 'Image unavailable.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'popup-media-retry';
      retry.textContent = 'Retry';
      retry.onclick = async () => {
        if (retry.disabled) return;
        retry.disabled = true;
        await this._loadPopupImage(event, container, kind);
      };
      container.replaceChildren(message, retry);
    }
  }

  /**
   * Find camera entity ID from friendly name.
   * Searches for UniFi Protect camera entities matching the display name.
   */
  _findCameraEntityId(friendlyName) {
    if (!this._hass || !friendlyName) return null;

    const configuredEntity = this._config.camera_entities?.[friendlyName];
    if (configuredEntity && this._hass.states[configuredEntity]) return configuredEntity;

    const normalizeName = (name) => name.trim().toLowerCase().replace(/\s+camera$/, '');
    const normalizedSearch = normalizeName(friendlyName);

    for (const [entityId, state] of Object.entries(this._hass.states)) {
      if (!entityId.startsWith('camera.')) continue;
      const friendlyNameAttribute = state.attributes?.friendly_name;
      if (!friendlyNameAttribute) continue;
      const name = normalizeName(friendlyNameAttribute);
      if (name === normalizedSearch) return entityId;
    }

    // UniFi Protect names camera entities "<Camera> High resolution channel",
    // "<Camera> Medium resolution channel", "<Camera> Package camera".
    // Fall back to a prefix match, preferring the highest resolution.
    const rank = (name) => name.includes('package') ? 99 : name.includes('high') ? 0 : name.includes('medium') ? 1 : name.includes('low') ? 2 : 3;
    let best = null;
    for (const [entityId, state] of Object.entries(this._hass.states)) {
      if (!entityId.startsWith('camera.') || state.state === 'unavailable') continue;
      const name = normalizeName(state.attributes?.friendly_name || '');
      if (!name.startsWith(normalizedSearch + ' ')) continue;
      const score = rank(name);
      if (score < 99 && (!best || score < best.score)) best = { entityId, score };
    }
    return best ? best.entityId : null;
  }

  _getVisibleEvents() {
    const events = [];
    const groups = this._getDisplayedGroups();
    for (const group of groups) {
      events.push(group.header);
      // Only groups mode has expandable children
      if (this._viewMode === 'groups') {
        const isExpanded = this._expandedGroups.has(group.groupKey);
        if (isExpanded) {
          events.push(...group.children);
        }
      }
    }
    return events;
  }

  async _loadThumbnails() {
    for (const event of this._getVisibleEvents()) {
      if (!this._thumbnailCache.has(event.event_id)) {
        const blobUrl = await this._fetchWithAuth(event.thumbnail_url, this._thumbnailCache, event.event_id);
        if (blobUrl) {
          const img = this.shadowRoot.querySelector(`img[data-event-id="${event.event_id}"]`);
          if (img) { img.src = blobUrl; img.style.opacity = '1'; }
        }
      }
    }
  }

  async _loadEvents(resetDisplay = true) {
    if (!this._hass) { this._error = 'Waiting for Home Assistant...'; this._render(); return; }

    const isAutoRefresh = !resetDisplay;

    // Only show loading state on manual refresh
    if (!isAutoRefresh) {
      this._loading = true; this._error = null;
      this._displayLimit = 50;
      this._render();
    }

    try {
      // Format datetime with local timezone offset (not UTC) - matches HA expected format
      const formatLocalISO = (d) => {
        const offset = -d.getTimezoneOffset();
        const sign = offset >= 0 ? '+' : '-';
        const pad = (n) => String(Math.abs(n)).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(offset/60))}:${pad(offset%60)}`;
      };
      // Use REST API POST to /api/services/calendar/get_events?return_response
      // This endpoint has NO event limit (unlike /api/calendars/{id} which caps at 50)
      const response = await this._hass.callApi('POST', 'services/calendar/get_events?return_response', {
        entity_id: this._config.calendar_entity,
        start_date_time: formatLocalISO(this._startDate),
        end_date_time: formatLocalISO(this._endDate)
      });
      // REST API returns: { service_response: { "calendar.xxx": { events: [...] } } }
      const calendarKey = this._config.calendar_entity;
      const events = response?.service_response?.[calendarKey]?.events || [];
      if (events.length > 0 || response?.service_response?.[calendarKey]) {
        const newEvents = events.map(e => this._parseCalendarEvent(e)).filter(e => e !== null)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // Smart refresh: compare new events to previous
        if (isAutoRefresh && this._events.length > 0) {
          const newLeadIds = new Set(newEvents.filter(e => e.status === 'lead').map(e => e.event_id));
          const hasNewLeadEvent = [...newLeadIds].some(id => !this._previousLeadEventIds.has(id));
          const eventIdsChanged = newEvents.length !== this._events.length ||
            newEvents.some((e, i) => e.event_id !== this._events[i]?.event_id);

          if (!eventIdsChanged) {
            // No changes at all - skip re-render entirely
            return;
          }

          // Update data
          this._events = newEvents;
          this._previousLeadEventIds = newLeadIds;
          this._personHistory = await this._fetchPersonHistory();
          this._computePersonContexts();
          this._loading = false; this._error = null;

          if (hasNewLeadEvent) {
            // New LEAD event - full render and scroll to top
            this._render();
            const eventsContainer = this.shadowRoot.querySelector('.events');
            if (eventsContainer) eventsContainer.scrollTop = 0;
          } else {
            // Only suppressed events changed - silent update, preserve scroll
            this._renderPreserveScroll();
          }
          return;
        }

        // Manual refresh or first load
        this._events = newEvents;
        this._previousLeadEventIds = new Set(newEvents.filter(e => e.status === 'lead').map(e => e.event_id));
        this._personHistory = await this._fetchPersonHistory();
        this._computePersonContexts();
        this._loading = false; this._error = null;
      } else { this._error = 'No events returned'; this._loading = false; }
    } catch (e) {
      this._error = `Failed to load: ${e.message || 'Unknown error'}`;
      this._loading = false;
    }
    this._render();
  }

  _renderPreserveScroll() {
    const eventsContainer = this.shadowRoot.querySelector('.events');
    const savedScrollTop = eventsContainer ? eventsContainer.scrollTop : 0;
    this._render();
    if (savedScrollTop > 0) {
      const newEventsContainer = this.shadowRoot.querySelector('.events');
      if (newEventsContainer) newEventsContainer.scrollTop = savedScrollTop;
    }
  }

  /**
   * Toggle group expansion via DOM manipulation instead of full re-render.
   * This preserves scroll position naturally since the DOM isn't replaced.
   * Only works in 'groups' mode.
   */
  _toggleGroupDOM(groupKey) {
    if (this._viewMode !== 'groups') return;
    const groupEl = this.shadowRoot.querySelector(`.event-group[data-group-key="${groupKey}"]`);
    if (!groupEl) return;

    const expandIcon = groupEl.querySelector('.group-expand-icon');
    const existingChildren = groupEl.querySelector('.group-children');

    if (this._expandedGroups.has(groupKey)) {
      // Collapse: remove children div
      this._expandedGroups.delete(groupKey);
      if (existingChildren) existingChildren.remove();
      if (expandIcon) expandIcon.classList.remove('expanded');
    } else {
      // Expand: add children div
      this._expandedGroups.add(groupKey);
      if (expandIcon) expandIcon.classList.add('expanded');

      // Find the group data to render children
      const groups = this._getFilteredGroups();
      const group = groups.find(g => g.groupKey === groupKey);
      if (group && group.children.length > 0) {
        const childrenDiv = document.createElement('div');
        childrenDiv.className = 'group-children';
        for (const child of group.children) {
          childrenDiv.innerHTML += this._renderEvent(child, false, false, 0, true);
        }
        groupEl.appendChild(childrenDiv);

        // Attach click listeners to new children
        childrenDiv.querySelectorAll('.event').forEach(el => {
          el.onclick = () => {
            this._lastInteractionTime = Date.now();
            const event = this._events.find(e => e.event_id === el.dataset.id);
            if (event) this._showPopup(event);
          };
        });

        // Load thumbnails for new children
        this._loadThumbnails();

        // Recalculate container height since card position may have shifted
        requestAnimationFrame(() => {
          this._updateEventsContainerHeight();

          // Scroll to reveal last child if below visible area
          const eventsContainer = this.shadowRoot?.querySelector('.events');
          const lastChild = childrenDiv.lastElementChild;
          if (eventsContainer && lastChild) {
            const containerRect = eventsContainer.getBoundingClientRect();
            const lastChildRect = lastChild.getBoundingClientRect();

            // If last child bottom is below container visible area
            if (lastChildRect.bottom > containerRect.bottom) {
              // Calculate how much to scroll down
              const scrollAmount = lastChildRect.bottom - containerRect.bottom + 10; // 10px padding
              eventsContainer.scrollBy({ top: scrollAmount, behavior: 'smooth' });
            }
          }
        });
      }
    }
  }

  _parseCalendarEvent(event) {
    try {
      const location = event.location || '';
      const [thumbnailUrl, cameraFriendly] = location.split(',');
      if (!thumbnailUrl || !thumbnailUrl.startsWith('/api/unifiprotect/thumbnail/')) return null;
      const urlParts = thumbnailUrl.split('/');
      const description = event.description || '';
      const statusMatch = description.match(/Status:\s*(\w+)/i);
      const leadTimeMatch = description.match(/LeadTime:\s*([^\n]+)/i);
      const suppressReasonsMatch = description.match(/SuppressReasons:\s*([^\n]+)/i);
      const suppressSessionMatch = description.match(/SuppressSessionStart:\s*([^\n]+)/i);

      // Parse suppress reasons into array
      let suppressReasons = [];
      if (suppressReasonsMatch && suppressReasonsMatch[1].trim() !== 'none') {
        suppressReasons = suppressReasonsMatch[1].trim().split(',').map(r => r.trim()).filter(r => r);
      }

      return {
        // Handle both REST API format ({dateTime:...}) and call_service format (string directly)
        timestamp: typeof event.start === 'string' ? event.start : (event.start?.dateTime || event.start?.date || new Date().toISOString()),
        camera_friendly: cameraFriendly || 'Unknown',
        detection_type: (event.summary || 'unknown').toLowerCase(),
        status: statusMatch ? statusMatch[1].toLowerCase() : 'unknown',
        leadTime: leadTimeMatch ? leadTimeMatch[1].trim() : null,
        suppressReasons: suppressReasons,
        suppressSessionStart: suppressSessionMatch ? suppressSessionMatch[1].trim() : null,
        nvr_id: urlParts[4], event_id: urlParts[5], thumbnail_url: thumbnailUrl,
        video_url: `/api/unifiprotect/video/${urlParts[4]}/${urlParts[5]}`
      };
    } catch (e) { return null; }
  }

  /**
   * People to correlate with camera events ("Alex arriving").
   * person_entities: false disables it; a list limits it; default is every person.* entity.
   */
  _personEntities() {
    const configured = this._config?.person_entities;
    if (configured === false) return [];
    if (Array.isArray(configured)) return configured.filter(e => typeof e === 'string' && e.startsWith('person.'));
    return Object.keys(this._hass?.states || {}).filter(e => e.startsWith('person.'));
  }

  _personDisplayName(entityId) {
    const friendly = this._hass?.states?.[entityId]?.attributes?.friendly_name;
    const raw = (friendly || entityId.replace('person.', '').replace(/_/g, ' ')).trim();
    const first = raw.split(/\s+/)[0] || raw;
    return first.charAt(0).toUpperCase() + first.slice(1);
  }

  async _fetchPersonHistory() {
    if (!this._hass) return [];
    try {
      const extendedStart = new Date(this._startDate.getTime() - 3 * 60 * 1000);
      const extendedEnd = new Date(this._endDate.getTime() + 2 * 60 * 1000);
      const people = this._personEntities();
      if (people.length === 0) return [];
      const url = `/api/history/period/${extendedStart.toISOString()}?filter_entity_id=${people.map(encodeURIComponent).join(',')}&minimal_response&end_time=${extendedEnd.toISOString()}`;
      const response = await this._hass.fetchWithAuth(url);
      if (response.ok) return await response.json();
    } catch (e) {
      console.warn('PersonContext: Failed to fetch person history', e);
    }
    return [];
  }

  _computePersonContexts() {
    this._personContextMap = new Map();
    if (!this._personHistory || this._personHistory.length === 0) return;

    // Build flat list of state transitions with flicker filtering
    const transitions = [];
    for (const entityHistory of this._personHistory) {
      if (!entityHistory || entityHistory.length < 2) continue;
      const entityId = entityHistory[0].entity_id;
      const displayName = this._personDisplayName(entityId);

      for (let i = 1; i < entityHistory.length; i++) {
        const prev = entityHistory[i - 1];
        const curr = entityHistory[i];
        const prevTime = new Date(prev.last_changed).getTime();
        const currTime = new Date(curr.last_changed).getTime();

        // GPS flicker filter: skip if previous state lasted <3 min
        if (currTime - prevTime < 3 * 60 * 1000) continue;

        if (prev.state === 'not_home' && curr.state === 'home') {
          transitions.push({ name: displayName, type: 'arriving', time: currTime });
        } else if (prev.state === 'home' && curr.state === 'not_home') {
          transitions.push({ name: displayName, type: 'departing', time: currTime });
        }
      }
    }

    // Correlate transitions with camera events
    for (const event of this._events) {
      const eventTime = new Date(event.timestamp).getTime();
      const matches = [];

      for (const t of transitions) {
        if (t.type === 'arriving') {
          // Within 3 min BEFORE or 1 min AFTER event
          if (t.time >= eventTime - 3 * 60 * 1000 && t.time <= eventTime + 1 * 60 * 1000) matches.push(t);
        } else if (t.type === 'departing') {
          // Within 1 min BEFORE or 2 min AFTER event (GPS updates after camera)
          if (t.time >= eventTime - 1 * 60 * 1000 && t.time <= eventTime + 2 * 60 * 1000) matches.push(t);
        }
      }

      if (matches.length > 0) {
        const arrivingNames = [...new Set(matches.filter(m => m.type === 'arriving').map(m => m.name))];
        const departingNames = [...new Set(matches.filter(m => m.type === 'departing').map(m => m.name))];
        // Conflict suppression: if same person appears in both arriving AND departing
        // for a single event, it's GPS bounce — suppress both for that person
        const conflicted = arrivingNames.filter(n => departingNames.includes(n));
        const arriving = arrivingNames.filter(n => !conflicted.includes(n));
        const departing = departingNames.filter(n => !conflicted.includes(n));
        const parts = [];
        if (arriving.length > 0) parts.push(`${arriving.join(' & ')} arriving`);
        if (departing.length > 0) parts.push(`${departing.join(' & ')} departing`);
        if (parts.length > 0) this._personContextMap.set(event.event_id, parts.join(', '));
      }
    }
  }

  /**
   * Group events by shared LeadTime value.
   * - Events with same LeadTime = one group
   * - LEAD events (no LeadTime) can be group header if suppressed event's LeadTime matches within 5s
   * - Events with no LeadTime and Status != LEAD = ungrouped
   * Returns array of group objects: { header: event, children: [events], groupKey: string }
   */
  _groupEvents(events) {
    // Build map of LeadTime -> events
    const leadTimeMap = new Map(); // LeadTime string -> array of events
    const leadEvents = []; // LEAD events (no LeadTime)
    const ungrouped = []; // Events with no LeadTime and not LEAD

    for (const e of events) {
      if (e.leadTime) {
        const key = e.leadTime;
        if (!leadTimeMap.has(key)) leadTimeMap.set(key, []);
        leadTimeMap.get(key).push(e);
      } else if (e.status === 'lead') {
        leadEvents.push(e);
      } else {
        ungrouped.push(e);
      }
    }

    const groups = [];

    // Process LeadTime groups
    for (const [leadTimeKey, groupEvents] of leadTimeMap) {
      // Sort by timestamp (earliest first)
      groupEvents.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Check if any LEAD event matches this LeadTime within 5 seconds
      const leadTimeMs = new Date(leadTimeKey).getTime();
      let matchedLead = null;
      for (let i = 0; i < leadEvents.length; i++) {
        const leadMs = new Date(leadEvents[i].timestamp).getTime();
        if (Math.abs(leadMs - leadTimeMs) <= 5000) {
          matchedLead = leadEvents[i];
          leadEvents.splice(i, 1); // Remove from leadEvents so it's not duplicated
          break;
        }
      }

      // Header is matched LEAD or earliest event in group
      const header = matchedLead || groupEvents[0];
      const children = matchedLead ? groupEvents : groupEvents.slice(1);

      groups.push({
        groupKey: leadTimeKey,
        header: header,
        children: children
      });
    }

    // Remaining LEAD events without matching groups become standalone groups
    for (const lead of leadEvents) {
      groups.push({
        groupKey: lead.event_id,
        header: lead,
        children: []
      });
    }

    // Ungrouped events become single-item groups
    for (const e of ungrouped) {
      groups.push({
        groupKey: e.event_id,
        header: e,
        children: []
      });
    }

    // Sort groups by header timestamp (newest first)
    groups.sort((a, b) => new Date(b.header.timestamp) - new Date(a.header.timestamp));

    return groups;
  }

  /**
   * Merge nearby groups whose LEAD timestamps are within 3 minutes of each other.
   * - Only merges groups with the same detection type (person+person, vehicle+vehicle)
   * - Different detection types stay separate (person + vehicle = two groups)
   * - Earlier LEAD becomes header, later LEAD becomes child
   * - Orphaned suppressed events (no LEAD match) are not merged
   */
  _mergeNearbyGroups(groups) {
    if (groups.length <= 1) return groups;

    const THREE_MINUTES = 3 * 60 * 1000;

    // Sort by header timestamp (oldest first for forward merging)
    const sorted = [...groups].sort((a, b) =>
      new Date(a.header.timestamp) - new Date(b.header.timestamp)
    );

    const merged = [];

    for (const group of sorted) {
      // Identify orphaned suppressed events: groupKey is event_id and status is not 'lead'
      // These were events with no LeadTime that weren't LEAD events
      const isOrphan = group.groupKey === group.header.event_id && group.header.status !== 'lead';

      if (isOrphan || merged.length === 0) {
        merged.push(group);
        continue;
      }

      const lastGroup = merged[merged.length - 1];
      const lastIsOrphan = lastGroup.groupKey === lastGroup.header.event_id && lastGroup.header.status !== 'lead';

      if (lastIsOrphan) {
        merged.push(group);
        continue;
      }

      // Check time difference between LEAD timestamps
      const timeDiff = Math.abs(
        new Date(group.header.timestamp).getTime() -
        new Date(lastGroup.header.timestamp).getTime()
      );

      // Check detection type compatibility (person+person, vehicle+vehicle)
      const type1 = lastGroup.header.detection_type;
      const type2 = group.header.detection_type;
      const sameType = type1 === type2;

      if (timeDiff <= THREE_MINUTES && sameType) {
        // Merge: current group's header becomes a child of the last group
        // Keep the earlier (lastGroup) as the header
        lastGroup.children.push(group.header);
        lastGroup.children.push(...group.children);

        // Re-sort children by timestamp (oldest first within group)
        lastGroup.children.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      } else {
        merged.push(group);
      }
    }

    // Sort back to newest first for display
    merged.sort((a, b) => new Date(b.header.timestamp) - new Date(a.header.timestamp));

    return merged;
  }

  /**
   * Get contextual label for a group based on combined SuppressReasons of children.
   * Priority: outdoor_activity > arrival > departure > vehicle
   * Returns { text: string, color: string } or null
   */
  _getGroupLabel(group) {
    // Only show labels in Groups mode
    if (this._viewMode !== 'groups') return null;

    // Don't show labels for standalone events (no children = nothing was suppressed)
    if (group.children.length === 0) return null;

    // Collect all suppress reasons from all children
    const allReasons = new Set();
    for (const child of group.children) {
      if (child.suppressReasons) {
        child.suppressReasons.forEach(r => allReasons.add(r));
      }
    }

    // If no suppress reasons, no label
    if (allReasons.size === 0) return null;

    // Priority-based label selection
    if (allReasons.has('outdoor_activity')) {
      return { text: 'Outdoor Activity', color: '#ff9800' };
    }

    if (allReasons.has('person_arrival')) {
      // Check if PersonContext has a name for any child
      let name = null;
      for (const child of group.children) {
        const ctx = this._personContextMap.get(child.event_id);
        if (ctx && ctx.includes('arriving')) {
          // Extract name from context like "Alex arriving"
          const match = ctx.match(/^(\w+)\s+arriving/);
          if (match) {
            name = match[1];
            break;
          }
        }
      }
      return { text: name ? `${name} Arrival` : 'Arrival', color: '#009688' };
    }

    if (allReasons.has('person_departure')) {
      // Check if PersonContext has a name for any child
      let name = null;
      for (const child of group.children) {
        const ctx = this._personContextMap.get(child.event_id);
        if (ctx && ctx.includes('departing')) {
          const match = ctx.match(/^(\w+)\s+departing/);
          if (match) {
            name = match[1];
            break;
          }
        }
      }
      return { text: name ? `${name} Departure` : 'Departure', color: '#009688' };
    }

    if ([...allReasons].some(r => r === 'vehicle_active' || r.endsWith('_active'))) {
      return { text: 'Vehicle Active', color: '#2196f3' };
    }

    // Fallback: no meaningful label for other reasons (path_grouping, existing_sensor)
    return null;
  }

  _getCameras() {
    const cameras = new Set();
    this._events.forEach(e => cameras.add(e.camera_friendly));
    return Array.from(cameras).sort();
  }

  _getTypes() {
    const types = new Set();
    this._events.forEach(e => types.add(e.detection_type));
    return Array.from(types).sort();
  }

  _getFilteredEvents() {
    let events = this._events;
    if (this._cameraFilter !== 'all') events = events.filter(e => e.camera_friendly === this._cameraFilter);
    if (this._typeFilter !== 'all') events = events.filter(e => e.detection_type === this._typeFilter);
    return events;
  }

  _getFilteredGroups() {
    const events = this._getFilteredEvents();

    // Mode-specific grouping
    if (this._viewMode === 'alerts') {
      // Alerts mode: flat list of LEAD events only (no grouping, no children)
      const leadEvents = events.filter(e => e.status === 'lead');
      return leadEvents.map(e => ({
        groupKey: e.event_id,
        header: e,
        children: []
      }));
    }

    if (this._viewMode === 'all') {
      // All mode: flat chronological list of every event (no grouping)
      return events.map(e => ({
        groupKey: e.event_id,
        header: e,
        children: []
      }));
    }

    // Groups mode: full grouping behavior
    let groups = this._groupEvents(events);

    // Merge nearby groups (within 3 minutes, same camera)
    groups = this._mergeNearbyGroups(groups);

    // Filter groups based on camera filter (already applied to events)
    // Also filter children by camera if needed
    if (this._cameraFilter !== 'all') {
      for (const group of groups) {
        group.children = group.children.filter(e => e.camera_friendly === this._cameraFilter);
      }
      // Remove groups where header doesn't match camera (but keep if has matching children)
      return groups.filter(g => g.header.camera_friendly === this._cameraFilter || g.children.length > 0);
    }

    return groups;
  }

  _getDisplayedGroups() {
    const limit = Math.min(this._displayLimit, this._config.max_events);
    return this._getFilteredGroups().slice(0, limit);
  }

  _getTotalEventCount() {
    const groups = this._getFilteredGroups().slice(0, this._config.max_events);
    let count = 0;
    for (const g of groups) {
      count += 1 + g.children.length;
    }
    return count;
  }

  _getDisplayedEvents() { return this._getFilteredEvents().slice(0, this._displayLimit); }

  _formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  }

  _formatDateLabel(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  _getDateDisplayLabel() {
    if (this._datePreset === 'today') return 'Today';
    if (this._datePreset === 'yesterday') return 'Yesterday';
    if (this._datePreset === '7days') return 'Last 7 Days';
    const opts = { month: 'short', day: 'numeric' };
    const s = this._startDate.toLocaleDateString('en-US', opts);
    // Check if single-day range (end = start + 1 day at midnight)
    const nextDay = new Date(this._startDate);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    if (this._endDate.getTime() === nextDay.getTime()) return s;
    // Multi-day range
    const e = this._endDate.toLocaleDateString('en-US', opts);
    return s === e ? s : `${s} – ${e}`;
  }

  _formatDateForInput(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  _applyDatePreset(preset, reload = true) {
    const now = new Date();
    this._datePreset = preset;
    switch (preset) {
      case 'today':
        this._startDate = new Date(now); this._startDate.setHours(0, 0, 0, 0);
        this._endDate = new Date(); break;
      case 'yesterday':
        this._startDate = new Date(now); this._startDate.setDate(this._startDate.getDate() - 1); this._startDate.setHours(0, 0, 0, 0);
        this._endDate = new Date(now); this._endDate.setHours(0, 0, 0, 0); break;
      case '7days':
        this._startDate = new Date(now); this._startDate.setDate(this._startDate.getDate() - 7); this._startDate.setHours(0, 0, 0, 0);
        this._endDate = new Date(); break;
    }
    this._savePreferences();
    if (reload) this._loadEvents();
  }

  _navigateDate(direction) {
    const days = this._datePreset === '7days' ? 7 : 1;
    const delta = direction === 'prev' ? -days : days;
    this._startDate = new Date(this._startDate.getTime() + delta * 24 * 60 * 60 * 1000);
    this._startDate.setHours(0, 0, 0, 0); // Normalize to midnight

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

    if (this._startDate.toDateString() === todayStart.toDateString()) {
      // Viewing today: end at current time
      this._datePreset = 'today';
      this._endDate = new Date();
    } else if (this._startDate < todayStart) {
      // Viewing a past period: end at start of next period (full day coverage)
      this._endDate = new Date(this._startDate);
      this._endDate.setDate(this._endDate.getDate() + days);
      this._endDate.setHours(0, 0, 0, 0);
      // Check if this matches 'yesterday' preset
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      this._datePreset = (this._startDate.toDateString() === yesterdayStart.toDateString() && days === 1) ? 'yesterday' : 'custom';
    } else {
      // Future date (edge case)
      this._datePreset = 'custom';
      this._endDate = new Date(this._startDate);
      this._endDate.setDate(this._endDate.getDate() + days);
    }

    this._savePreferences();
    this._loadEvents();
  }

  _getColors(type) { return CameraEventsCard.COLORS[type] || CameraEventsCard.COLORS.default; }
  _getIcon(type) { return CameraEventsCard.ICONS[type] || CameraEventsCard.ICONS.default; }

  _showDateDialog() {
    const dialog = document.createElement('div');
    dialog.innerHTML = `
      <div class="date-dialog-overlay">
        <div class="date-dialog">
          <div class="date-dialog-header">
            <span>Select Date Range</span>
            <button class="date-dialog-close"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="date-dialog-presets">
            <button class="preset-btn ${this._datePreset === 'today' ? 'active' : ''}" data-preset="today">Today</button>
            <button class="preset-btn ${this._datePreset === 'yesterday' ? 'active' : ''}" data-preset="yesterday">Yesterday</button>
            <button class="preset-btn ${this._datePreset === '7days' ? 'active' : ''}" data-preset="7days">Last 7 Days</button>
          </div>
          <div class="date-dialog-custom">
            <div class="date-field">
              <label>From</label>
              <input type="date" class="date-input-start" value="${this._formatDateForInput(this._startDate)}">
            </div>
            <div class="date-field">
              <label>To</label>
              <input type="date" class="date-input-end" value="${this._formatDateForInput(this._endDate)}">
            </div>
          </div>
          <button class="date-dialog-apply">Apply</button>
        </div>
      </div>
      <style>
        .date-dialog-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:1001; }
        .date-dialog { background:var(--ha-card-background, var(--card-background-color, #1c1c1c)); color:var(--primary-text-color, #fff); padding:20px; border-radius:12px; min-width:280px; box-shadow:0 4px 20px rgba(0,0,0,0.3); }
        .date-dialog-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; font-weight:500; font-size:16px; }
        .date-dialog-close { background:none; border:none; cursor:pointer; color:var(--primary-text-color, #fff); padding:4px; }
        .date-dialog-presets { display:flex; flex-direction:column; gap:8px; margin-bottom:16px; }
        .preset-btn { padding:12px 16px; border:1px solid var(--divider-color, #333); border-radius:8px; background:transparent; color:var(--primary-text-color, #fff); font-size:14px; cursor:pointer; text-align:left; transition:all 0.15s; }
        .preset-btn:hover { background:var(--secondary-background-color, #333); }
        .preset-btn.active { background:var(--primary-color, #03a9f4); border-color:var(--primary-color, #03a9f4); color:#fff; }
        .date-dialog-custom { display:flex; gap:12px; margin-bottom:16px; }
        .date-field { flex:1; }
        .date-field label { display:block; font-size:12px; color:var(--secondary-text-color, #aaa); margin-bottom:4px; }
        .date-field input { width:100%; padding:10px; border:1px solid var(--divider-color, #333); border-radius:6px; background:var(--secondary-background-color, #333); color:var(--primary-text-color, #fff); font-size:14px; }
        .date-dialog-apply { width:100%; padding:12px; background:var(--primary-color, #03a9f4); color:#fff; border:none; border-radius:8px; font-size:14px; font-weight:500; cursor:pointer; }
        .date-dialog-apply:hover { opacity:0.9; }
      </style>
    `;

    const overlay = dialog.querySelector('.date-dialog-overlay');
    const closeBtn = dialog.querySelector('.date-dialog-close');
    const applyBtn = dialog.querySelector('.date-dialog-apply');
    const startInput = dialog.querySelector('.date-input-start');
    const endInput = dialog.querySelector('.date-input-end');

    const close = () => dialog.remove();
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    dialog.querySelectorAll('.preset-btn').forEach(btn => {
      btn.onclick = () => {
        this._applyDatePreset(btn.dataset.preset);
        close();
      };
    });

    applyBtn.onclick = () => {
      this._startDate = new Date(startInput.value); this._startDate.setHours(0, 0, 0, 0);
      this._endDate = new Date(endInput.value); this._endDate.setHours(23, 59, 59, 999);
      this._datePreset = 'custom';
      this._savePreferences();
      this._loadEvents();
      close();
    };

    document.body.appendChild(dialog);
  }

  async _showPopup(event) {
    // Get cached images
    const thumbnailUrl = this._thumbnailCache.get(event.event_id);
    const snapshotUrl = this._snapshotCache.get(event.event_id);

    const colors = this._getColors(event.detection_type);
    const icon = this._getIcon(event.detection_type);
    const title = `${event.detection_type.charAt(0).toUpperCase() + event.detection_type.slice(1)} – ${event.camera_friendly}`;
    const time = new Date(event.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const popupContext = this._personContextMap.get(event.event_id);

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="popup-overlay">
        <div class="popup-content">
          <div class="popup-header">
            <div class="popup-icon" style="background:${colors.bg};"><ha-icon icon="${icon}" style="color:${colors.icon};"></ha-icon></div>
            <div class="popup-title">${title}</div>
            <button class="popup-close"><ha-icon icon="mdi:close"></ha-icon></button>
          </div>
          <div class="popup-images">
            <div class="popup-image-section">
              <div class="popup-image-label">Detection</div>
              <div class="popup-thumbnail-container">${thumbnailUrl ? `<img src="${thumbnailUrl}" class="popup-thumb">` : 'Loading...'}</div>
            </div>
            <div class="popup-image-section">
              <div class="popup-image-label">Full Frame</div>
              <div class="popup-snapshot-container">
                ${snapshotUrl ? `<img src="${snapshotUrl}" class="popup-snapshot">` : '<div class="popup-snapshot-placeholder"><div class="loading-spinner"></div></div>'}
              </div>
            </div>
          </div>
          <div class="popup-meta">
            <span>${time}${popupContext ? ` <span class="popup-person-context">• ${popupContext}</span>` : ''}</span>
            <span class="popup-status ${event.status}">${event.status}</span>
          </div>
          <button class="popup-video-btn"><ha-icon icon="mdi:play-circle"></ha-icon> Load Video</button>
          <div class="popup-video-container"><video controls class="popup-video"></video></div>
        </div>
      </div>
      <style>
        .popup-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.7); display:flex; align-items:center; justify-content:center; z-index:1000; opacity:0; transition:opacity 0.15s; }
        .popup-overlay.show { opacity:1; }
        .popup-content { background:var(--ha-card-background, var(--card-background-color, #1c1c1c)); color:var(--primary-text-color, #fff); padding:16px; border-radius:12px; max-width:500px; width:90%; max-height:85vh; overflow-y:auto; }
        .popup-header { display:flex; align-items:center; gap:10px; margin-bottom:12px; }
        .popup-icon { width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .popup-title { flex:1; font-size:16px; font-weight:500; color:var(--primary-text-color, #fff); }
        .popup-close { background:none; border:none; cursor:pointer; color:var(--primary-text-color, #fff); padding:4px; }
        .popup-images { display:flex; flex-direction:column; gap:12px; margin-bottom:12px; }
        .popup-image-section { }
        .popup-image-label { font-size:11px; font-weight:600; color:var(--secondary-text-color, #aaa); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; display:flex; align-items:center; gap:8px; }
        .loading-text { font-weight:400; opacity:0.7; }
        .popup-thumb { max-width:200px; border-radius:8px; display:block; }
        .popup-snapshot { width:100%; border-radius:8px; display:block; }
        .popup-snapshot-container { position:relative; }
        .popup-snapshot-placeholder { width:100%; aspect-ratio:16/9; background:var(--secondary-background-color, #333); border-radius:8px; display:flex; align-items:center; justify-content:center; }
        .loading-spinner { width:24px; height:24px; border:3px solid rgba(255,255,255,0.2); border-top-color:#fff; border-radius:50%; animation:spin 0.8s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
        .popup-no-image { background:var(--secondary-background-color, #333); border-radius:8px; display:flex; align-items:center; justify-content:center; color:var(--secondary-text-color, #aaa); font-size:12px; }
        .popup-no-image.small { width:120px; height:90px; }
        .popup-media-error { color:var(--secondary-text-color, #aaa); font-size:13px; padding:8px 0; }
        .popup-media-retry { padding:8px 16px; border:none; border-radius:8px; background:var(--primary-color, #03a9f4); color:#fff; cursor:pointer; }
        .popup-media-retry:disabled { opacity:0.5; }
        .popup-meta { display:flex; justify-content:space-between; align-items:center; font-size:13px; color:var(--secondary-text-color, #aaa); margin-bottom:12px; }
        .popup-status { padding:2px 8px; border-radius:10px; font-size:11px; font-weight:600; text-transform:uppercase; }
        .popup-status.lead { background:linear-gradient(135deg,#FFD700,#FFA500); color:#333; }
        .popup-status.suppressed { background:#666; color:#fff; }
        .popup-person-context { opacity:0.8; }
        .popup-video-btn { width:100%; padding:10px; background:var(--primary-color, #03a9f4); color:#fff; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; font-size:14px; }
        .popup-video-btn:disabled { opacity:0.5; }
        .popup-video-container { display:none; margin-top:10px; }
        .popup-video { width:100%; border-radius:8px; background:#000; }
      </style>
    `;

    const overlay = wrapper.querySelector('.popup-overlay');
    const closeBtn = wrapper.querySelector('.popup-close');
    const videoBtn = wrapper.querySelector('.popup-video-btn');
    const videoContainer = wrapper.querySelector('.popup-video-container');
    const videoEl = wrapper.querySelector('.popup-video');

    const close = () => { overlay.classList.remove('show'); setTimeout(() => wrapper.remove(), 150); };
    closeBtn.onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    videoBtn.onclick = async () => {
      videoBtn.disabled = true;
      videoBtn.innerHTML = '<ha-icon icon="mdi:loading"></ha-icon> Loading...';
      const url = await this._fetchWithAuth(event.video_url, this._videoCache, `video_${event.event_id}`);
      if (url) { videoEl.src = url; videoContainer.style.display = 'block'; videoBtn.style.display = 'none'; }
      else { videoBtn.innerHTML = 'Video unavailable'; }
    };

    document.body.appendChild(wrapper);
    requestAnimationFrame(() => overlay.classList.add('show'));

    await Promise.all([
      this._loadPopupImage(event, wrapper.querySelector('.popup-thumbnail-container'), 'thumbnail'),
      this._loadPopupImage(event, wrapper.querySelector('.popup-snapshot-container'), 'snapshot')
    ]);
  }

  _render() {
    if (!this._config) { this.shadowRoot.innerHTML = '<ha-card><div style="padding:16px">No configuration</div></ha-card>'; return; }

    const cameras = this._getCameras();
    const types = this._getTypes();
    // Validate camera filter - reset to 'all' if stored camera no longer exists in event data
    // Only validate when events are loaded (cameras array is populated)
    if (cameras.length > 0 && this._cameraFilter !== 'all' && !cameras.includes(this._cameraFilter)) {
      this._cameraFilter = 'all';
      this._savePreferences();
    }
    // Validate type filter - reset to 'all' if stored type no longer exists in event data
    if (types.length > 0 && this._typeFilter !== 'all' && !types.includes(this._typeFilter)) {
      this._typeFilter = 'all';
      this._savePreferences();
    }
    const filteredGroups = this._getFilteredGroups();
    const displayedGroups = this._getDisplayedGroups();
    const totalEvents = this._getTotalEventCount();
    const hasMore = displayedGroups.length < filteredGroups.length;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        ha-card { padding:12px; max-width:800px; margin:0 auto; }

        .header { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .title { font-size:16px; font-weight:500; }
        .count { font-size:12px; color:var(--secondary-text-color); margin-left:4px; }
        .spacer { flex:1; }

        /* Date navigation - Energy dashboard style */
        .date-nav { display:flex; align-items:center; gap:2px; }
        .nav-btn { background:none; border:none; cursor:pointer; color:var(--primary-text-color); padding:6px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .nav-btn:hover { background:var(--secondary-background-color); }
        .nav-btn ha-icon { --mdc-icon-size:20px; }
        .date-label { padding:6px 12px; background:var(--secondary-background-color); color:var(--primary-text-color); border:none; font:inherit; border-radius:8px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px; }
        .date-label:hover { background:var(--primary-color); color:#fff; }
        .date-label ha-icon { --mdc-icon-size:18px; }

        .refresh-btn { background:none; border:none; cursor:pointer; color:var(--secondary-text-color); padding:6px; border-radius:50%; }
        .refresh-btn:hover { color:var(--primary-text-color); background:var(--secondary-background-color); }
        .refresh-btn ha-icon { --mdc-icon-size:18px; }

        .filters { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; align-items:center; }
        .filter-sep { width:1px; height:18px; background:var(--divider-color); margin:0 2px; }
        .filter-select, .view-mode-select { padding:4px 10px; border:none; border-radius:12px; background:var(--secondary-background-color); color:var(--primary-text-color); font-size:11px; cursor:pointer; }
        .view-mode-select.alerts-mode { background:linear-gradient(135deg,#FFD700,#FFA500); color:#333; font-weight:600; }

        .events { display:flex; flex-direction:column; gap:2px; overflow-y:auto; }
        .date-header { font-size:10px; font-weight:600; color:var(--secondary-text-color); padding:8px 0 4px; text-transform:uppercase; letter-spacing:0.5px; }
        .event { display:flex; align-items:center; padding:6px 8px; border-radius:8px; cursor:pointer; transition:background 0.15s; }
        .event:hover { background:var(--secondary-background-color); }
        .event-icon { width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-right:10px; flex-shrink:0; }
        .event-icon ha-icon { --mdc-icon-size:16px; }
        .event-info { flex:1; min-width:0; }
        .event-title { font-size:13px; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .event-meta { font-size:11px; color:var(--secondary-text-color); display:flex; align-items:center; gap:6px; }
        .status-dot { width:6px; height:6px; border-radius:50%; }
        .status-dot.lead { background:#FFA500; }
        .status-dot.suppressed { background:#888; }
        .person-context { opacity: 0.8; }
        .event-thumb { width:50px; height:38px; border-radius:4px; object-fit:cover; background:var(--secondary-background-color); margin-left:8px; flex-shrink:0; opacity:0.5; }

        .footer { text-align:center; padding:8px 0; }
        .load-more { padding:6px 16px; border:none; border-radius:12px; background:var(--secondary-background-color); color:var(--primary-text-color); font-size:11px; cursor:pointer; }
        .load-more:hover { background:var(--primary-color); color:#fff; }
        .showing { font-size:10px; color:var(--secondary-text-color); margin-top:4px; }

        .empty, .loading, .error { text-align:center; padding:20px; color:var(--secondary-text-color); font-size:13px; }
        .error { color:var(--error-color); }

        /* Group styles */
        .event-group { margin-bottom:2px; }
        .group-header { position:relative; }
        .group-header .event { background:var(--secondary-background-color); border-radius:8px; }
        .group-header .event:hover { background:var(--primary-background-color); }
        .group-badge { background:linear-gradient(135deg,#FFD700,#FFA500); color:#333; font-size:10px; font-weight:600; padding:2px 6px; border-radius:10px; margin-left:8px; }
        .group-label { font-size:10px; font-weight:500; padding:2px 8px; border-radius:10px; margin-left:6px; }
        .group-expand-icon { margin-left:auto; color:var(--secondary-text-color); transition:transform 0.2s; }
        .group-expand-icon.expanded { transform:rotate(180deg); }
        .group-children { margin-left:20px; border-left:2px solid var(--divider-color, #333); padding-left:8px; }
        .group-children .event { opacity:0.9; }

        /* Suppress reason chips */
        .suppress-chips { display:flex; flex-wrap:wrap; gap:4px; margin-top:4px; }
        .suppress-chip { display:inline-flex; align-items:center; gap:3px; padding:2px 6px; border-radius:10px; font-size:10px; font-weight:500; }
      </style>

      <ha-card>
        <div class="header">
          <span class="title">Camera Events</span>
          ${!this._loading ? `<span class="count">(${totalEvents})</span>` : ''}
          <span class="spacer"></span>
          <div class="date-nav">
            <button class="nav-btn nav-prev" title="Previous"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
            <button class="date-label" title="Select date range">
              <ha-icon icon="mdi:calendar"></ha-icon>
              ${this._getDateDisplayLabel()}
            </button>
            <button class="nav-btn nav-next" title="Next"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
          </div>
          <button class="refresh-btn" title="Refresh"><ha-icon icon="mdi:refresh"></ha-icon></button>
        </div>

        ${this._loading ? '<div class="loading">Loading...</div>' : this._error ? `<div class="error">${this._error}</div>` : `
          <div class="filters">
            <select class="view-mode-select${this._viewMode === 'alerts' ? ' alerts-mode' : ''}">
              <option value="alerts" ${this._viewMode === 'alerts' ? 'selected' : ''}>Alerts</option>
              <option value="groups" ${this._viewMode === 'groups' ? 'selected' : ''}>Groups</option>
              <option value="all" ${this._viewMode === 'all' ? 'selected' : ''}>All</option>
            </select>
            <div class="filter-sep"></div>
            <select class="filter-select camera-filter">
              <option value="all" ${this._cameraFilter === 'all' ? 'selected' : ''}>All Cameras</option>
              ${cameras.map(c => `<option value="${c}" ${this._cameraFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <select class="filter-select type-filter">
              <option value="all" ${this._typeFilter === 'all' ? 'selected' : ''}>All Types</option>
              ${types.map(t => `<option value="${t}" ${this._typeFilter === t ? 'selected' : ''}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('')}
            </select>
          </div>

          <div class="events">
            ${displayedGroups.length === 0 ? `<div class="empty">No ${this._viewMode === 'alerts' ? 'alerts' : this._viewMode === 'groups' ? 'groups' : 'events'}</div>` : this._renderGroups(displayedGroups)}
          </div>

          ${displayedGroups.length > 0 ? `
            <div class="footer">
              ${hasMore ? '<button class="load-more">Load More</button>' : ''}
              <div class="showing">Showing ${displayedGroups.length} groups of ${filteredGroups.length}</div>
            </div>
          ` : ''}
        `}
      </ha-card>
    `;

    this._attachListeners();
    if (!this._loading && !this._error && displayedGroups.length > 0) this._loadThumbnails();

    // Set dynamic height after DOM is rendered
    requestAnimationFrame(() => this._updateEventsContainerHeight());
  }

  _renderGroups(groups) {
    let html = '';
    let lastDate = '';

    for (const group of groups) {
      const e = group.header;
      const dateLabel = this._formatDateLabel(e.timestamp);
      if (dateLabel !== lastDate) {
        html += `<div class="date-header">${dateLabel}</div>`;
        lastDate = dateLabel;
      }

      const hasChildren = group.children.length > 0 && this._viewMode === 'groups';
      const isExpanded = hasChildren && this._expandedGroups.has(group.groupKey);
      const groupLabel = this._getGroupLabel(group);

      html += `<div class="event-group" data-group-key="${group.groupKey}">`;

      // Group header
      html += `<div class="group-header">`;
      html += this._renderEvent(e, hasChildren, isExpanded, hasChildren ? group.children.length : 0, false, groupLabel);
      html += `</div>`;

      // Children (if expanded)
      if (hasChildren && isExpanded) {
        html += `<div class="group-children">`;
        for (const child of group.children) {
          html += this._renderEvent(child, false, false, 0, true);
        }
        html += `</div>`;
      }

      html += `</div>`;
    }
    return html;
  }

  _renderEvent(e, isGroupHeader, isExpanded, childCount, isChild = false, groupLabel = null) {
    const colors = this._getColors(e.detection_type);
    const icon = this._getIcon(e.detection_type);
    const type = e.detection_type.charAt(0).toUpperCase() + e.detection_type.slice(1);
    const thumb = this._thumbnailCache.get(e.event_id);
    const context = this._personContextMap.get(e.event_id);
    const contextHtml = context ? ` <span class="person-context">• ${context}</span>` : '';

    // Group label for headers (replaces per-event chips)
    let labelHtml = '';
    if (groupLabel) {
      labelHtml = `<span class="group-label" style="background:${groupLabel.color}22; color:${groupLabel.color};">${groupLabel.text}</span>`;
    }

    return `
      <div class="event" data-id="${e.event_id}" ${isGroupHeader ? `data-group-toggle="${e.event_id}"` : ''}>
        <div class="event-icon" style="background:${colors.bg};"><ha-icon icon="${icon}" style="color:${colors.icon};"></ha-icon></div>
        <div class="event-info">
          <div class="event-title">${type} – ${e.camera_friendly}${isGroupHeader && childCount > 0 ? `<span class="group-badge">+${childCount}</span>` : ''}${labelHtml}</div>
          <div class="event-meta"><span class="status-dot ${e.status}"></span>${this._formatTime(e.timestamp)}${contextHtml}</div>
        </div>
        ${isGroupHeader && childCount > 0 ? `<ha-icon icon="mdi:chevron-down" class="group-expand-icon ${isExpanded ? 'expanded' : ''}"></ha-icon>` : ''}
        <img class="event-thumb" data-event-id="${e.event_id}" src="${thumb || 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22/>'}" style="${thumb ? 'opacity:1' : ''}">
      </div>`;
  }

  _attachListeners() {
    // Track scroll interactions
    this.shadowRoot.querySelector('.events')?.addEventListener('scroll', () => {
      this._lastInteractionTime = Date.now();
    });

    // Date navigation
    this.shadowRoot.querySelector('.nav-prev')?.addEventListener('click', () => this._navigateDate('prev'));
    this.shadowRoot.querySelector('.nav-next')?.addEventListener('click', () => this._navigateDate('next'));
    this.shadowRoot.querySelector('.date-label')?.addEventListener('click', () => this._showDateDialog());

    // View mode dropdown
    this.shadowRoot.querySelector('.view-mode-select')?.addEventListener('change', (e) => {
      this._viewMode = e.target.value;
      this._displayLimit = 50;
      this._expandedGroups.clear(); // Reset expansion state when switching modes
      this._savePreferences();
      this._render();
    });
    // Camera filter dropdown
    this.shadowRoot.querySelector('.camera-filter')?.addEventListener('change', (e) => {
      this._cameraFilter = e.target.value;
      this._displayLimit = 50;
      this._savePreferences();
      this._render();
    });
    // Type filter dropdown
    this.shadowRoot.querySelector('.type-filter')?.addEventListener('change', (e) => {
      this._typeFilter = e.target.value;
      this._displayLimit = 50;
      this._savePreferences();
      this._render();
    });

    // Group toggle (click on expand icon or group header)
    this.shadowRoot.querySelectorAll('.group-header').forEach(el => {
      const expandIcon = el.querySelector('.group-expand-icon');
      const eventEl = el.querySelector('.event');
      const groupKey = el.closest('.event-group')?.dataset.groupKey;

      if (expandIcon && groupKey) {
        // Clicking expand icon toggles group via DOM manipulation (preserves scroll)
        expandIcon.onclick = (e) => {
          e.stopPropagation();
          this._lastInteractionTime = Date.now();
          this._toggleGroupDOM(groupKey);
        };
      }

      // Clicking event opens popup
      if (eventEl) {
        eventEl.onclick = () => {
          this._lastInteractionTime = Date.now();
          const event = this._events.find(e => e.event_id === eventEl.dataset.id);
          if (event) this._showPopup(event);
        };
      }
    });

    // Child events - click opens popup
    this.shadowRoot.querySelectorAll('.group-children .event').forEach(el => {
      el.onclick = () => {
        this._lastInteractionTime = Date.now();
        const event = this._events.find(e => e.event_id === el.dataset.id);
        if (event) this._showPopup(event);
      };
    });

    // Other buttons
    this.shadowRoot.querySelector('.refresh-btn')?.addEventListener('click', () => { this._setRefreshInterval(180000); this._loadEvents(); });
    this.shadowRoot.querySelector('.load-more')?.addEventListener('click', () => { this._displayLimit += 50; this._setRefreshInterval(300000); this._render(); });
  }

  getCardSize() { return 4; }
}

customElements.define('camera-events-card', CameraEventsCard);
window.customCards = window.customCards || [];
window.customCards.push({ type: 'camera-events-card', name: 'UniFi Protect Events Card', description: 'UniFi Protect detections with thumbnails, snapshots and video', preview: true });
console.info('%c CAMERA-EVENTS-CARD %c v1.12.1 ', 'color:white;background:#3498db;font-weight:bold;', 'color:#3498db;background:white;font-weight:bold;');

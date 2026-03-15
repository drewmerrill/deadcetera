/**
 * gl-entity-picker.js — Reusable Entity Picker + Venue Create Modal
 * Phase 1: Canonical Entity Selection
 *
 * Provides:
 *   glEntityPicker(opts)     — search-as-you-type combobox
 *   glVenueCreateModal(opts) — venue creation with duplicate detection
 *
 * LOAD ORDER: after groovelinx_store.js, before feature files.
 */

(function () {
  'use strict';

  // ── Styles ───────────────────────────────────────────────────────────────

  function _injectStyles() {
    if (document.getElementById('gl-entity-picker-styles')) return;
    var style = document.createElement('style');
    style.id = 'gl-entity-picker-styles';
    style.textContent = [
      '.glep-wrap { position:relative; }',
      '.glep-input { width:100%; box-sizing:border-box; }',
      '.glep-dropdown {',
      '  position:absolute; left:0; right:0; top:100%; z-index:800;',
      '  background:#1e293b; border:1px solid rgba(255,255,255,0.12);',
      '  border-radius:8px; margin-top:4px; max-height:280px; overflow-y:auto;',
      '  box-shadow:0 8px 24px rgba(0,0,0,0.4);',
      '}',
      '.glep-item {',
      '  padding:8px 12px; cursor:pointer; font-size:0.85em;',
      '  color:#e2e8f0; border-bottom:1px solid rgba(255,255,255,0.04);',
      '  display:flex; align-items:center; gap:8px;',
      '}',
      '.glep-item:last-child { border-bottom:none; }',
      '.glep-item:hover, .glep-item.glep-active { background:rgba(99,102,241,0.15); }',
      '.glep-item-sub { font-size:0.75em; color:#94a3b8; }',
      '.glep-create {',
      '  padding:8px 12px; cursor:pointer; font-size:0.85em;',
      '  color:var(--accent-light,#818cf8); border-top:1px solid rgba(255,255,255,0.08);',
      '  display:flex; align-items:center; gap:6px;',
      '}',
      '.glep-create:hover { background:rgba(99,102,241,0.12); }',
      '.glep-selected-tag {',
      '  display:inline-flex; align-items:center; gap:6px; margin-top:6px;',
      '  background:rgba(99,102,241,0.15); border:1px solid rgba(99,102,241,0.25);',
      '  border-radius:6px; padding:4px 10px; font-size:0.82em; color:#c7d2fe;',
      '}',
      '.glep-selected-tag button {',
      '  background:none; border:none; color:#94a3b8; cursor:pointer;',
      '  font-size:1em; padding:0 2px; line-height:1;',
      '}',
      '.glep-selected-tag button:hover { color:#ef4444; }',
      // Venue create modal
      '.glep-modal-overlay {',
      '  position:fixed; top:0; left:0; right:0; bottom:0;',
      '  background:rgba(0,0,0,0.7); z-index:9999;',
      '  display:flex; align-items:center; justify-content:center; padding:20px;',
      '}',
      '.glep-modal-card {',
      '  background:#1e293b; border-radius:12px; padding:24px;',
      '  width:100%; max-width:420px;',
      '}',
      '.glep-dup-warn {',
      '  background:rgba(251,191,36,0.1); border:1px solid rgba(251,191,36,0.3);',
      '  border-radius:8px; padding:10px 12px; margin-top:12px; font-size:0.85em;',
      '}',
      '.glep-dup-item {',
      '  display:flex; align-items:center; justify-content:space-between;',
      '  padding:6px 0; gap:8px;',
      '}',
      '.glep-dup-item button {',
      '  background:rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.3);',
      '  color:#818cf8; border-radius:6px; padding:3px 10px; cursor:pointer;',
      '  font-size:0.82em; white-space:nowrap;',
      '}',
    ].join('\n');
    document.head.appendChild(style);
  }

  // ── Entity Picker ────────────────────────────────────────────────────────

  /**
   * Create a search-as-you-type entity picker.
   * @param {object} opts
   *   containerId  — ID of the DOM element to render into
   *   items        — array of items to search
   *   labelFn      — function(item) → display string
   *   subLabelFn   — optional function(item) → secondary text
   *   onSelect     — function(item) called when user picks an item
   *   onCreateNew  — function(typedText) called when user clicks "Create new"
   *   placeholder  — input placeholder text
   *   emptyText    — text shown when no items exist
   *   selectedItem — pre-selected item (for edit forms)
   * @returns {{ setValue(id), getValue(), getSelectedItem(), refresh(items), destroy() }}
   */
  window.glEntityPicker = function (opts) {
    _injectStyles();

    var container = document.getElementById(opts.containerId);
    if (!container) return null;

    var items = opts.items || [];
    var labelFn = opts.labelFn || function (i) { return i.name || ''; };
    var subLabelFn = opts.subLabelFn || null;
    var onSelect = opts.onSelect || function () {};
    var onCreateNew = opts.onCreateNew || null;
    var placeholder = opts.placeholder || 'Search...';

    var _selectedItem = opts.selectedItem || null;
    var _dropdownOpen = false;
    var _activeIdx = -1;

    // Build DOM
    var wrap = document.createElement('div');
    wrap.className = 'glep-wrap';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'app-input glep-input';
    input.placeholder = placeholder;
    input.autocomplete = 'off';

    var dropdown = document.createElement('div');
    dropdown.className = 'glep-dropdown';
    dropdown.style.display = 'none';

    var selectedTag = document.createElement('div');
    selectedTag.style.display = 'none';

    wrap.appendChild(input);
    wrap.appendChild(dropdown);
    wrap.appendChild(selectedTag);
    container.innerHTML = '';
    container.appendChild(wrap);

    // Show selected state if pre-selected
    if (_selectedItem) {
      _showSelected(_selectedItem);
    }

    // ── Event handlers ──

    input.addEventListener('input', function () {
      _activeIdx = -1;
      _renderDropdown(input.value);
    });

    input.addEventListener('focus', function () {
      _renderDropdown(input.value);
    });

    input.addEventListener('keydown', function (e) {
      if (!_dropdownOpen) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          _renderDropdown(input.value);
          e.preventDefault();
        }
        return;
      }
      var visibleItems = dropdown.querySelectorAll('.glep-item');
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        _activeIdx = Math.min(_activeIdx + 1, visibleItems.length - 1);
        _highlightActive(visibleItems);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        _activeIdx = Math.max(_activeIdx - 1, 0);
        _highlightActive(visibleItems);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (_activeIdx >= 0 && visibleItems[_activeIdx]) {
          visibleItems[_activeIdx].click();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        _closeDropdown();
      }
    });

    // Close on click outside
    function _onDocClick(e) {
      if (!wrap.contains(e.target)) {
        _closeDropdown();
      }
    }
    document.addEventListener('click', _onDocClick, true);

    // ── Rendering ──

    function _renderDropdown(query) {
      var q = (query || '').toLowerCase().trim();
      var filtered = items.filter(function (item) {
        return labelFn(item).toLowerCase().indexOf(q) >= 0;
      });
      // If no query, show all (max 8 recent)
      if (!q) {
        filtered = items.slice(0, 8);
      } else {
        filtered = filtered.slice(0, 8);
      }

      var html = '';
      filtered.forEach(function (item, idx) {
        var label = _esc(labelFn(item));
        var sub = subLabelFn ? _esc(subLabelFn(item)) : '';
        html += '<div class="glep-item" data-idx="' + idx + '">'
          + '<div style="flex:1;min-width:0">'
          + '<div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + label + '</div>'
          + (sub ? '<div class="glep-item-sub">' + sub + '</div>' : '')
          + '</div></div>';
      });

      if (onCreateNew && q) {
        html += '<div class="glep-create">+ Create new: <strong>' + _esc(query) + '</strong></div>';
      }

      if (!html && !q) {
        html = '<div style="padding:10px;color:#94a3b8;font-size:0.85em;text-align:center">'
          + (opts.emptyText || 'No items') + '</div>';
      }

      dropdown.innerHTML = html;
      dropdown.style.display = html ? '' : 'none';
      _dropdownOpen = !!html;

      // Attach click handlers to items
      var itemEls = dropdown.querySelectorAll('.glep-item');
      itemEls.forEach(function (el, i) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          var item = filtered[i];
          if (item) {
            _selectItem(item);
          }
        });
      });

      // Attach click handler to create CTA
      var createEl = dropdown.querySelector('.glep-create');
      if (createEl) {
        createEl.addEventListener('click', function (e) {
          e.stopPropagation();
          _closeDropdown();
          if (onCreateNew) onCreateNew(input.value.trim());
        });
      }
    }

    function _highlightActive(visibleItems) {
      visibleItems.forEach(function (el, i) {
        el.classList.toggle('glep-active', i === _activeIdx);
      });
    }

    function _closeDropdown() {
      dropdown.style.display = 'none';
      _dropdownOpen = false;
      _activeIdx = -1;
    }

    function _selectItem(item) {
      _selectedItem = item;
      _closeDropdown();
      input.value = '';
      _showSelected(item);
      onSelect(item);
    }

    function _showSelected(item) {
      var label = _esc(labelFn(item));
      selectedTag.className = 'glep-selected-tag';
      selectedTag.style.display = '';
      selectedTag.innerHTML = '<span>' + label + '</span><button type="button" title="Clear">&times;</button>';
      input.style.display = 'none';
      var clearBtn = selectedTag.querySelector('button');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          _clearSelection();
        });
      }
    }

    function _clearSelection() {
      _selectedItem = null;
      selectedTag.style.display = 'none';
      selectedTag.innerHTML = '';
      input.style.display = '';
      input.value = '';
      input.focus();
      onSelect(null);
    }

    // ── Public API ──

    return {
      setValue: function (id) {
        var item = items.find(function (i) { return i.venueId === id || i.id === id; });
        if (item) {
          _selectedItem = item;
          _showSelected(item);
          onSelect(item);
        }
      },
      getValue: function () {
        return _selectedItem ? (_selectedItem.venueId || _selectedItem.id || null) : null;
      },
      getSelectedItem: function () {
        return _selectedItem;
      },
      refresh: function (newItems) {
        items = newItems || [];
      },
      destroy: function () {
        document.removeEventListener('click', _onDocClick, true);
        container.innerHTML = '';
      }
    };
  };

  // ── Venue Create Modal ───────────────────────────────────────────────────

  /**
   * Show a modal to create a new venue with duplicate detection.
   * @param {object} opts
   *   initialName — pre-fill venue name
   *   onSave(venue) — called with the created venue object
   *   onCancel()    — called when modal is dismissed
   *   onUseExisting(venue) — called when user chooses an existing duplicate
   */
  window.glVenueCreateModal = function (opts) {
    _injectStyles();

    var initialName = opts.initialName || '';
    var onSave = opts.onSave || function () {};
    var onCancel = opts.onCancel || function () {};
    var onUseExisting = opts.onUseExisting || opts.onSave || function () {};

    // Remove any existing modal
    var existing = document.getElementById('glepVenueModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'glepVenueModal';
    overlay.className = 'glep-modal-overlay';

    overlay.innerHTML = '<div class="glep-modal-card">'
      + '<h3 style="margin:0 0 16px;color:#fff">Add New Venue</h3>'
      + '<div class="form-row" style="margin-bottom:10px"><label class="form-label">Venue Name</label>'
      + '<input class="app-input" id="glepVenueName" placeholder="e.g. The Earl" value="' + _esc(initialName) + '"></div>'
      + '<div class="form-row" style="margin-bottom:10px"><label class="form-label">City / Area</label>'
      + '<input class="app-input" id="glepVenueCity" placeholder="e.g. Atlanta, GA"></div>'
      + '<div class="form-row" style="margin-bottom:16px"><label class="form-label">Address (optional)</label>'
      + '<input class="app-input" id="glepVenueAddress" placeholder="e.g. 488 Flat Shoals Ave"></div>'
      + '<div id="glepDupWarning"></div>'
      + '<div style="display:flex;gap:8px;margin-top:12px">'
      + '<button id="glepVenueSaveBtn" class="btn btn-success" style="flex:1">Save Venue</button>'
      + '<button id="glepVenueCancelBtn" class="btn btn-ghost" style="flex:1">Cancel</button>'
      + '</div></div>';

    document.body.appendChild(overlay);

    // Focus name input
    setTimeout(function () {
      var nameInput = document.getElementById('glepVenueName');
      if (nameInput) nameInput.focus();
    }, 100);

    // Cancel
    document.getElementById('glepVenueCancelBtn').addEventListener('click', function () {
      overlay.remove();
      onCancel();
    });

    // Click overlay bg to close
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.remove();
        onCancel();
      }
    });

    // Save with duplicate check
    var _dupChecked = false;
    document.getElementById('glepVenueSaveBtn').addEventListener('click', async function () {
      var name = (document.getElementById('glepVenueName') || {}).value || '';
      var city = (document.getElementById('glepVenueCity') || {}).value || '';
      var address = (document.getElementById('glepVenueAddress') || {}).value || '';
      name = name.trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('Please enter a venue name');
        else alert('Please enter a venue name');
        return;
      }

      // Check duplicates (only on first attempt)
      if (!_dupChecked && typeof GLStore !== 'undefined' && GLStore.findDuplicateVenues) {
        var dupes = await GLStore.findDuplicateVenues(name);
        if (dupes.length > 0) {
          _dupChecked = true;
          var warnEl = document.getElementById('glepDupWarning');
          if (warnEl) {
            var warnHtml = '<div class="glep-dup-warn">'
              + '<div style="font-weight:600;color:#fbbf24;margin-bottom:6px">Similar venues found:</div>';
            dupes.forEach(function (d, i) {
              var lbl = _esc(d.venue.name);
              if (d.venue.city) lbl += ' — ' + _esc(d.venue.city);
              warnHtml += '<div class="glep-dup-item">'
                + '<span style="color:#e2e8f0">' + lbl + ' <span style="color:#94a3b8;font-size:0.8em">(' + d.similarity + ')</span></span>'
                + '<button data-dup-idx="' + i + '">Use this</button>'
                + '</div>';
            });
            warnHtml += '<div style="margin-top:8px;font-size:0.82em;color:#94a3b8">Click "Save Venue" again to create anyway.</div>';
            warnHtml += '</div>';
            warnEl.innerHTML = warnHtml;
            // Wire "Use this" buttons
            warnEl.querySelectorAll('[data-dup-idx]').forEach(function (btn) {
              btn.addEventListener('click', function () {
                var idx = parseInt(btn.dataset.dupIdx);
                var venue = dupes[idx].venue;
                overlay.remove();
                onUseExisting(venue);
              });
            });
          }
          return; // Don't save yet — user must click again or use existing
        }
      }

      // Create venue via store
      if (typeof GLStore !== 'undefined' && GLStore.createVenue) {
        var venue = await GLStore.createVenue({ name: name, city: city, address: address });
        overlay.remove();
        if (typeof showToast === 'function') showToast('Venue saved!');
        onSave(venue);
      }
    });
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function _esc(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  console.log('gl-entity-picker.js loaded');
})();

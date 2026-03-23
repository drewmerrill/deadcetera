// ============================================================================
// js/ui/gl-spotlight.js
// Lightweight spotlight walkthrough system — no external libraries.
//
// API:
//   glSpotlight.register(key, steps)      — register a walkthrough
//   glSpotlight.run(key, steps?, opts?)    — run by key (or inline steps)
//   glSpotlight.next()                     — advance to next step
//   glSpotlight.prev()                     — go back one step
//   glSpotlight.skip()                     — dismiss and mark done
//   glSpotlight.reset(key)                — clear completion for re-trigger
//   glSpotlight.resetAll()                — clear all walkthrough completions
//   glSpotlight.runAllPending()           — run first uncompleted registered walkthrough
//   glSpotlight.list()                    — list registered walkthrough keys
//
// Step shape:
//   {
//     target: selector | element | function,
//     text: string,
//     prepare: function (optional) — called BEFORE target resolution to
//              ensure UI is in the right state (e.g. open a menu)
//   }
// ============================================================================

window.glSpotlight = (function() {
    var _overlay = null;
    var _box = null;
    var _steps = [];
    var _current = 0;
    var _key = '';
    var _registry = {};

    // Escape key dismisses the spotlight
    function _escHandler(e) {
        if (e.key === 'Escape') { _markDone(_key); _cleanup(); }
    }

    function _isDone(key) {
        try { return localStorage.getItem('gl_wt_' + key) === '1'; } catch(e) { return false; }
    }
    function _isDoneCompat(key) {
        return _isDone(key) || (function() { try { return localStorage.getItem('gl_walkthrough_' + key) === 'done'; } catch(e) { return false; } })();
    }
    function _markDone(key) {
        try { localStorage.setItem('gl_wt_' + key, '1'); } catch(e) {}
    }

    function _ensureCSS() {
        if (document.getElementById('glSpotlightCSS')) return;
        var s = document.createElement('style');
        s.id = 'glSpotlightCSS';
        s.textContent = [
            '.gl-spot-overlay{position:fixed;inset:0;z-index:99990;pointer-events:auto;background:rgba(0,0,0,0.75)}',
            '.gl-spot-box{position:fixed;z-index:99992;background:#1e293b;border:1px solid rgba(99,102,241,0.4);border-radius:10px;padding:14px 16px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.6);animation:glSpotIn 0.25s ease-out}',
            '.gl-spot-text{font-size:0.88em;color:#e2e8f0;line-height:1.5;margin-bottom:12px}',
            '.gl-spot-nav{display:flex;align-items:center;gap:6px}',
            '.gl-spot-btn{padding:5px 12px;border-radius:6px;font-size:0.78em;font-weight:700;cursor:pointer;border:none}',
            '.gl-spot-btn-next{background:#6366f1;color:white}',
            '.gl-spot-btn-prev{background:none;color:#94a3b8;border:1px solid rgba(255,255,255,0.1)}',
            '.gl-spot-btn-skip{background:none;color:#64748b;font-size:0.72em;font-weight:400;border:none;padding:5px 6px}',
            '.gl-spot-btn-done{background:#22c55e;color:white}',
            '.gl-spot-dots{flex:1;text-align:center;font-size:0.65em;color:#64748b;letter-spacing:2px}',
            '@keyframes glSpotIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}'
        ].join('\n');
        document.head.appendChild(s);
    }

    function _cleanup() {
        if (_overlay) { _overlay.remove(); _overlay = null; }
        if (_box) { _box.remove(); _box = null; }
        // Remove glow elements
        if (window._glSpotGlow) {
            window._glSpotGlow.forEach(function(el) { el.remove(); });
            window._glSpotGlow = [];
        }
        // Remove escape listener
        document.removeEventListener('keydown', _escHandler);
        _steps = [];
        _current = 0;
    }

    function _resolveTarget(step) {
        if (typeof step.target === 'function') {
            try { return step.target(); } catch(e) { return null; }
        }
        if (typeof step.target === 'string') return document.querySelector(step.target);
        return step.target || null;
    }

    function _show(stepIdx) {
        _current = stepIdx;
        // Register escape key on first step
        if (stepIdx === 0) document.addEventListener('keydown', _escHandler);
        if (stepIdx < 0) { _current = 0; return; }
        if (stepIdx >= _steps.length) {
            _markDone(_key);
            _cleanup();
            return;
        }
        var step = _steps[stepIdx];

        // Prepare hook: ensure UI is in the right state before resolving target
        if (typeof step.prepare === 'function') {
            try { step.prepare(); } catch(e) {}
        }

        // Small delay for prepare() to take effect (DOM updates)
        setTimeout(function() {
            var target = _resolveTarget(step);

            // Skip missing targets gracefully (forward only)
            if (!target) { _show(stepIdx + 1); return; }

            // Scroll target to CENTER of viewport — try nested scroll containers first
            var targetRect = target.getBoundingClientRect();
            var scrollContainer = target.closest('.main-content') || target.closest('#gl-shell > .main-content') || null;
            if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
                // Nested scroll container (e.g., #mainContent inside #gl-shell)
                var containerRect = scrollContainer.getBoundingClientRect();
                var targetOffsetInContainer = targetRect.top - containerRect.top + scrollContainer.scrollTop;
                var scrollTo = targetOffsetInContainer - (scrollContainer.clientHeight / 2) + (targetRect.height / 2);
                scrollContainer.scrollTo({ top: Math.max(0, scrollTo), behavior: 'smooth' });
            } else {
                // Fallback: window scroll
                var scrollTarget = window.scrollY + targetRect.top - (window.innerHeight / 2) + (targetRect.height / 2);
                window.scrollTo({ top: Math.max(0, scrollTarget), behavior: 'smooth' });
            }

            // Wait for scroll to settle, then position everything
            setTimeout(function() {
                // Clean up previous step's glow
                if (window._glSpotGlow) {
                    window._glSpotGlow.forEach(function(el) { el.remove(); });
                    window._glSpotGlow = [];
                }
                var rect = target.getBoundingClientRect();
                var pad = 8;
                var vh = window.innerHeight;
                var vw = window.innerWidth;

                if (!_overlay) {
                    _overlay = document.createElement('div');
                    _overlay.className = 'gl-spot-overlay';
                    _overlay.onclick = function(e) { if (e.target === _overlay) { _markDone(_key); _cleanup(); } };
                    document.body.appendChild(_overlay);
                }
                _overlay.innerHTML = '';
                // Remove previous dialog box (now lives on body, not overlay)
                if (_box) { _box.remove(); _box = null; }

                // Clip-path cutout around target
                var hL = Math.max(0, rect.left - pad);
                var hT = Math.max(0, rect.top - pad);
                var hR = Math.min(vw, rect.right + pad);
                var hB = Math.min(vh, rect.bottom + pad);
                _overlay.style.clipPath = 'polygon('
                    + '0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, '
                    + hL + 'px ' + hT + 'px, '
                    + hL + 'px ' + hB + 'px, '
                    + hR + 'px ' + hB + 'px, '
                    + hR + 'px ' + hT + 'px, '
                    + hL + 'px ' + hT + 'px)';
                _overlay.style.webkitClipPath = _overlay.style.clipPath;

                // Bright highlight behind the cutout — makes target area pop
                var glow = document.createElement('div');
                glow.style.cssText = 'position:fixed;pointer-events:none;z-index:99989;border-radius:10px;background:rgba(99,102,241,0.12);box-shadow:0 0 40px 12px rgba(99,102,241,0.25),inset 0 0 20px rgba(99,102,241,0.08)';
                glow.style.left = (hL - 4) + 'px';
                glow.style.top = (hT - 4) + 'px';
                glow.style.width = (hR - hL + 8) + 'px';
                glow.style.height = (hB - hT + 8) + 'px';
                document.body.appendChild(glow);
                // Store for cleanup
                if (!window._glSpotGlow) window._glSpotGlow = [];
                window._glSpotGlow.push(glow);

                // Highlight ring around the cutout
                var ring = document.createElement('div');
                ring.style.cssText = 'position:fixed;pointer-events:none;z-index:99991;border:2px solid #a5b4fc;border-radius:10px;box-shadow:0 0 20px rgba(99,102,241,0.6),0 0 40px rgba(99,102,241,0.3)';
                ring.style.left = hL + 'px';
                ring.style.top = hT + 'px';
                ring.style.width = (hR - hL) + 'px';
                ring.style.height = (hB - hT) + 'px';
                _overlay.appendChild(ring);

                // Build info box
                _box = document.createElement('div');
                _box.className = 'gl-spot-box';

                var isFirst = stepIdx === 0;
                var isLast = stepIdx === _steps.length - 1;

                var navHtml = '<div class="gl-spot-nav">';
                if (!isFirst) {
                    navHtml += '<button class="gl-spot-btn gl-spot-btn-prev" onclick="glSpotlight.prev()">← Back</button>';
                } else {
                    navHtml += '<button class="gl-spot-btn gl-spot-btn-skip" onclick="glSpotlight.skip()">Skip</button>';
                }
                navHtml += '<span class="gl-spot-dots">' + (stepIdx + 1) + '/' + _steps.length + '</span>';
                if (isLast) {
                    navHtml += '<button class="gl-spot-btn gl-spot-btn-done" onclick="glSpotlight.next()">Got it!</button>';
                } else {
                    navHtml += '<button class="gl-spot-btn gl-spot-btn-skip" onclick="glSpotlight.skip()">Skip</button>';
                    navHtml += '<button class="gl-spot-btn gl-spot-btn-next" onclick="glSpotlight.next()">Next →</button>';
                }
                navHtml += '</div>';

                _box.innerHTML = '<div class="gl-spot-text">' + step.text + '</div>' + navHtml;

                // Measure box offscreen — append to BODY, not overlay
                // (overlay has clip-path which would clip the dialog)
                _box.style.top = '-9999px';
                _box.style.left = '12px';
                _box.style.maxWidth = Math.min(300, vw - 24) + 'px';
                document.body.appendChild(_box);
                var boxH = _box.offsetHeight;
                var boxW = _box.offsetWidth;
                var gap = 16;
                var margin = 12;

                // Position dialog — MUST be visible in viewport, prefer below target
                var boxTop;
                var margin = 12;
                var spaceBelow = vh - hB - gap;
                var spaceAbove = hT - gap;

                if (spaceBelow >= boxH + margin) {
                    // Fits below target — preferred (user reads top-down)
                    boxTop = hB + gap;
                } else if (spaceAbove >= boxH + margin) {
                    // Fits above target
                    boxTop = hT - gap - boxH;
                } else {
                    // Neither fits cleanly — dock to bottom of viewport
                    boxTop = vh - boxH - margin;
                }

                // HARD CLAMP — dialog must be fully visible no matter what
                boxTop = Math.max(margin, Math.min(boxTop, vh - boxH - margin));

                // Center horizontally
                var boxLeft = Math.max(margin, Math.round((vw - boxW) / 2));

                _box.style.top = boxTop + 'px';
                _box.style.left = boxLeft + 'px';
                _box.style.zIndex = '99992'; // ensure above overlay
            }, 350);
        }, 400); // allow nested container smooth-scroll to settle
    }

    return {
        register: function(key, steps) { _registry[key] = steps; },

        run: function(key, steps, opts) {
            opts = opts || {};
            if (!opts.force && _isDoneCompat(key)) return false;
            var resolvedSteps = steps || _registry[key];
            if (!resolvedSteps || !resolvedSteps.length) return false;
            _ensureCSS();
            _key = key;
            _steps = resolvedSteps;
            _current = 0;
            _show(0);
            return true;
        },

        next: function() { _show(_current + 1); },
        prev: function() { if (_current > 0) _show(_current - 1); },
        skip: function() { _markDone(_key); _cleanup(); },

        reset: function(key) {
            try {
                localStorage.removeItem('gl_wt_' + key);
                localStorage.removeItem('gl_walkthrough_' + key);
            } catch(e) {}
        },

        resetAll: function() {
            Object.keys(_registry).forEach(function(k) {
                try { localStorage.removeItem('gl_wt_' + k); localStorage.removeItem('gl_walkthrough_' + k); } catch(e) {}
            });
        },

        runAllPending: function() {
            var keys = Object.keys(_registry);
            for (var i = 0; i < keys.length; i++) {
                if (!_isDoneCompat(keys[i])) return this.run(keys[i]);
            }
            return false;
        },

        list: function() { return Object.keys(_registry); },
        isDone: function(key) { return _isDoneCompat(key); }
    };
})();

console.log('✅ gl-spotlight.js loaded');

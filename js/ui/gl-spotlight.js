// ============================================================================
// js/ui/gl-spotlight.js
// Lightweight spotlight walkthrough system — no external libraries.
//
// API:
//   glSpotlight.register(key, steps)     — register a walkthrough
//   glSpotlight.run(key, steps?, opts?)   — run by key (or inline steps)
//   glSpotlight.next()                    — advance to next step
//   glSpotlight.skip()                    — dismiss and mark done
//   glSpotlight.reset(key)               — clear completion for re-trigger
//   glSpotlight.resetAll()               — clear all walkthrough completions
//   glSpotlight.runAllPending()           — run first uncompleted registered walkthrough
//   glSpotlight.list()                    — list registered walkthrough keys
//
// Step shape: { target: selector|element|function, text: string }
// ============================================================================

window.glSpotlight = (function() {
    var _overlay = null;
    var _box = null;
    var _steps = [];
    var _current = 0;
    var _key = '';
    var _registry = {}; // key → steps[]

    function _isDone(key) {
        try { return localStorage.getItem('gl_wt_' + key) === '1'; } catch(e) { return false; }
    }
    // Backward compat: check old key format too
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
            '.gl-spot-nav{display:flex;align-items:center;gap:8px}',
            '.gl-spot-btn{padding:5px 14px;border-radius:6px;font-size:0.78em;font-weight:700;cursor:pointer;border:none}',
            '.gl-spot-btn-next{background:#6366f1;color:white}',
            '.gl-spot-btn-skip{background:none;color:#94a3b8;border:1px solid rgba(255,255,255,0.08)}',
            '.gl-spot-btn-done{background:#22c55e;color:white}',
            '.gl-spot-dots{flex:1;text-align:center;font-size:0.65em;color:#64748b;letter-spacing:2px}',
            '@keyframes glSpotIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}'
        ].join('\n');
        document.head.appendChild(s);
    }

    function _cleanup() {
        if (_overlay) { _overlay.remove(); _overlay = null; }
        _box = null;
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
        if (stepIdx >= _steps.length) {
            _markDone(_key);
            _cleanup();
            return;
        }
        var step = _steps[stepIdx];
        var target = _resolveTarget(step);

        // Skip missing targets gracefully
        if (!target) { _show(stepIdx + 1); return; }

        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        setTimeout(function() {
            var rect = target.getBoundingClientRect();
            var pad = 6;

            if (!_overlay) {
                _overlay = document.createElement('div');
                _overlay.className = 'gl-spot-overlay';
                _overlay.onclick = function(e) { if (e.target === _overlay) { _markDone(_key); _cleanup(); } };
                document.body.appendChild(_overlay);
            }
            _overlay.innerHTML = '';

            // Clip-path cutout: full viewport polygon with a rectangular hole
            var hL = rect.left - pad;
            var hT = rect.top - pad;
            var hR = rect.right + pad;
            var hB = rect.bottom + pad;
            var vw = window.innerWidth;
            var vh = window.innerHeight;
            // Polygon traces outer edge, then cuts inner hole (counter-clockwise)
            _overlay.style.clipPath = 'polygon('
                + '0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, '
                + hL + 'px ' + hT + 'px, '
                + hL + 'px ' + hB + 'px, '
                + hR + 'px ' + hB + 'px, '
                + hR + 'px ' + hT + 'px, '
                + hL + 'px ' + hT + 'px)';
            _overlay.style.webkitClipPath = _overlay.style.clipPath;

            // Info box
            _box = document.createElement('div');
            _box.className = 'gl-spot-box';

            var isLast = stepIdx === _steps.length - 1;
            var dots = '';
            for (var i = 0; i < _steps.length; i++) dots += (i === stepIdx) ? '●' : '○';

            _box.innerHTML = '<div class="gl-spot-text">' + step.text + '</div>'
                + '<div class="gl-spot-nav">'
                + '<button class="gl-spot-btn gl-spot-btn-skip" onclick="glSpotlight.skip()">Skip</button>'
                + '<span class="gl-spot-dots">' + dots + ' ' + (stepIdx + 1) + '/' + _steps.length + '</span>'
                + '<button class="gl-spot-btn ' + (isLast ? 'gl-spot-btn-done' : 'gl-spot-btn-next') + '" onclick="glSpotlight.next()">' + (isLast ? 'Got it!' : 'Next →') + '</button>'
                + '</div>';

            // Position: prefer below target, fall back above, clamp to viewport
            var boxTop = rect.bottom + pad + 10;
            var boxLeft = Math.max(12, Math.min(rect.left, window.innerWidth - 320));
            if (boxTop + 160 > window.innerHeight) {
                boxTop = Math.max(12, rect.top - pad - 140);
            }
            _box.style.top = boxTop + 'px';
            _box.style.left = boxLeft + 'px';
            _overlay.appendChild(_box);
        }, 150);
    }

    return {
        // Register a walkthrough for later use
        register: function(key, steps) {
            _registry[key] = steps;
        },

        // Run a walkthrough by key (uses registry) or with inline steps
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
        skip: function() { _markDone(_key); _cleanup(); },

        reset: function(key) {
            try {
                localStorage.removeItem('gl_wt_' + key);
                localStorage.removeItem('gl_walkthrough_' + key); // old format
            } catch(e) {}
        },

        resetAll: function() {
            var keys = Object.keys(_registry);
            keys.forEach(function(k) {
                try {
                    localStorage.removeItem('gl_wt_' + k);
                    localStorage.removeItem('gl_walkthrough_' + k);
                } catch(e) {}
            });
        },

        // Run the first uncompleted registered walkthrough
        runAllPending: function() {
            var keys = Object.keys(_registry);
            for (var i = 0; i < keys.length; i++) {
                if (!_isDoneCompat(keys[i])) {
                    return this.run(keys[i]);
                }
            }
            return false;
        },

        // List registered walkthrough keys
        list: function() { return Object.keys(_registry); },

        // Check if a walkthrough is completed
        isDone: function(key) { return _isDoneCompat(key); }
    };
})();

console.log('✅ gl-spotlight.js loaded');

// ============================================================================
// js/ui/gl-spotlight.js
// Lightweight spotlight walkthrough system — no external libraries.
// Usage: glSpotlight.run('walkthrough-key', [ { target, text }, ... ])
// ============================================================================

window.glSpotlight = (function() {
    var _overlay = null;
    var _box = null;
    var _steps = [];
    var _current = 0;
    var _key = '';

    function _isDone(key) {
        try { return localStorage.getItem('gl_walkthrough_' + key) === 'done'; } catch(e) { return false; }
    }

    function _markDone(key) {
        try { localStorage.setItem('gl_walkthrough_' + key, 'done'); } catch(e) {}
    }

    // Inject CSS once
    function _ensureCSS() {
        if (document.getElementById('glSpotlightCSS')) return;
        var s = document.createElement('style');
        s.id = 'glSpotlightCSS';
        s.textContent = [
            '.gl-spot-overlay{position:fixed;inset:0;z-index:99990;pointer-events:auto}',
            '.gl-spot-hole{position:absolute;box-shadow:0 0 0 9999px rgba(0,0,0,0.7);border-radius:8px;z-index:99991;pointer-events:none;transition:all 0.3s ease}',
            '.gl-spot-box{position:absolute;z-index:99992;background:#1e293b;border:1px solid rgba(99,102,241,0.4);border-radius:10px;padding:14px 16px;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.6);animation:glSpotIn 0.25s ease-out}',
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

    function _show(stepIdx) {
        _current = stepIdx;
        if (stepIdx >= _steps.length) {
            _markDone(_key);
            _cleanup();
            return;
        }
        var step = _steps[stepIdx];
        var target = null;

        // Resolve target: selector string, element, or function
        if (typeof step.target === 'function') target = step.target();
        else if (typeof step.target === 'string') target = document.querySelector(step.target);
        else target = step.target;

        // If target not found, skip this step
        if (!target) { _show(stepIdx + 1); return; }

        // Scroll target into view
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        // Small delay for scroll to settle
        setTimeout(function() {
            var rect = target.getBoundingClientRect();
            var pad = 6;

            // Create or update overlay
            if (!_overlay) {
                _overlay = document.createElement('div');
                _overlay.className = 'gl-spot-overlay';
                _overlay.onclick = function(e) { if (e.target === _overlay) _show(_steps.length); }; // click backdrop to dismiss
                document.body.appendChild(_overlay);
            }
            _overlay.innerHTML = '';

            // Hole (cutout around target)
            var hole = document.createElement('div');
            hole.className = 'gl-spot-hole';
            hole.style.left = (rect.left - pad + window.scrollX) + 'px';
            hole.style.top = (rect.top - pad) + 'px';
            hole.style.width = (rect.width + pad * 2) + 'px';
            hole.style.height = (rect.height + pad * 2) + 'px';
            _overlay.appendChild(hole);

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

            // Position box below or above target
            var boxTop = rect.bottom + pad + 10;
            var boxLeft = Math.max(12, Math.min(rect.left, window.innerWidth - 320));
            if (boxTop + 140 > window.innerHeight) {
                boxTop = rect.top - pad - 120; // above
            }
            _box.style.top = boxTop + 'px';
            _box.style.left = boxLeft + 'px';
            _overlay.appendChild(_box);
        }, 150);
    }

    return {
        run: function(key, steps, opts) {
            opts = opts || {};
            if (!opts.force && _isDone(key)) return;
            _ensureCSS();
            _key = key;
            _steps = steps;
            _current = 0;
            _show(0);
        },
        next: function() { _show(_current + 1); },
        skip: function() { _markDone(_key); _cleanup(); },
        reset: function(key) { try { localStorage.removeItem('gl_walkthrough_' + key); } catch(e) {} }
    };
})();

console.log('✅ gl-spotlight.js loaded');

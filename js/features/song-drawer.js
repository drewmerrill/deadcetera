// song-drawer.js — Global Song Drawer
// Slide-in drawer that renders full song detail without page navigation.
// Entry: window.openSongDrawer(title)
// Triggers: S key while hovering a song item, data-song-drawer attr click
// Closes: ESC, backdrop click, close button
(function() {
'use strict';

var _drawerOpen  = false;
var _drawerEl    = null;
var _backdropEl  = null;
var _hoveredSong = null;

function _sdInit() {
    if (document.getElementById('gl-song-drawer')) return;

    var backdrop = document.createElement('div');
    backdrop.id = 'gl-drawer-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1099;opacity:0;pointer-events:none;transition:opacity 0.25s ease;backdrop-filter:blur(2px)';
    backdrop.addEventListener('click', closeDrawer);
    document.body.appendChild(backdrop);
    _backdropEl = backdrop;

    var drawer = document.createElement('div');
    drawer.id = 'gl-song-drawer';
    drawer.style.cssText = 'position:fixed;top:0;right:0;height:100%;width:420px;max-width:100vw;background:var(--bg-card,#1e293b);border-left:1px solid rgba(255,255,255,0.08);z-index:1100;display:flex;flex-direction:column;transform:translateX(100%);transition:transform 0.3s cubic-bezier(0.32,0.72,0,1);box-shadow:-8px 0 40px rgba(0,0,0,0.45);overflow:hidden';

    var header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px 10px 16px;border-bottom:1px solid rgba(255,255,255,0.07);flex-shrink:0;background:rgba(0,0,0,0.2)';
    header.innerHTML = '<span style="font-size:0.72em;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-dim,#475569)">Quick View</span><button style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#94a3b8;border-radius:7px;padding:4px 10px;cursor:pointer;font-size:0.8em;font-weight:600" onclick="closeDrawer()">ESC</button>';

    var content = document.createElement('div');
    content.id = 'gl-drawer-content';
    content.style.cssText = 'flex:1;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch';

    drawer.appendChild(header);
    drawer.appendChild(content);
    document.body.appendChild(drawer);
    _drawerEl = drawer;

    var style = document.createElement('style');
    style.id = 'gl-drawer-styles';
    style.textContent = [
        '#gl-song-drawer .song-detail-page{max-width:100%;padding:0 0 60px}',
        '#gl-song-drawer .sd-back-btn{display:none}',
        '#gl-song-drawer .sd-header{padding:16px 16px 0}',
        '#gl-song-drawer .sd-tab-bar{padding:0 12px}',
        '#gl-song-drawer .sd-panels{padding:0 4px}',
        '#gl-song-drawer .sd-panel-inner{padding:12px}',
        '#gl-song-drawer h1.sd-title{font-size:1.5em}',
        '@media(max-width:480px){#gl-song-drawer{width:100vw}}'
    ].join('\n');
    document.head.appendChild(style);

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && _drawerOpen) { closeDrawer(); return; }
        if ((e.key === 's' || e.key === 'S') && !_drawerOpen && _hoveredSong &&
            !e.ctrlKey && !e.metaKey && !e.altKey &&
            !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) {
            openSongDrawer(_hoveredSong);
        }
    });

    document.addEventListener('click', function(e) {
        var el = e.target.closest('[data-song-drawer]');
        if (el) { e.stopPropagation(); openSongDrawer(el.dataset.songDrawer); }
    });

    document.addEventListener('mouseover', function(e) {
        var item = e.target.closest('.song-item,[data-song-title],[data-title]');
        if (item) {
            _hoveredSong = item.dataset.songTitle || item.dataset.title ||
                (item.querySelector('.song-name') ? item.querySelector('.song-name').textContent.trim() : null);
        }
    });
    document.addEventListener('mouseout', function(e) {
        var item = e.target.closest('.song-item,[data-song-title],[data-title]');
        if (item && !item.contains(e.relatedTarget)) _hoveredSong = null;
    });
}

function openSongDrawer(title) {
    if (!title) return;
    _sdInit();
    var content = document.getElementById('gl-drawer-content');
    if (!content) return;
    content.innerHTML = '<div id="gl-drawer-sd-root" style="min-height:100%"></div>';
    var root = document.getElementById('gl-drawer-sd-root');
    if (typeof window.renderSongDetail === 'function') {
        window.renderSongDetail(title, root);
    } else {
        root.innerHTML = '<div style="padding:24px;color:#94a3b8">Song detail unavailable.</div>';
    }
    _drawerOpen = true;
    _drawerEl.style.transform = 'translateX(0)';
    _backdropEl.style.opacity = '1';
    _backdropEl.style.pointerEvents = 'auto';
    content.scrollTop = 0;
    var scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '-' + scrollY + 'px';
    document.body.style.width = '100%';
    document.body.dataset.drawerScrollY = scrollY;
}

window.closeDrawer = function() {
    if (!_drawerEl) return;
    _drawerOpen = false;
    _drawerEl.style.transform = 'translateX(100%)';
    _backdropEl.style.opacity = '0';
    _backdropEl.style.pointerEvents = 'none';
    var scrollY = parseInt(document.body.dataset.drawerScrollY || '0', 10);
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    window.scrollTo(0, scrollY);
};

window.openSongDrawer = openSongDrawer;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _sdInit);
} else {
    _sdInit();
}

console.log('🎸 Song Drawer loaded');
})();

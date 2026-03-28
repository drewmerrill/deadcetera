/**
 * groovemate_help_validator.js — Help Content Validation
 *
 * Compares UI contracts against live DOM to detect stale help.
 * Runs on demand (admin tool), not on every page load.
 *
 * EXPOSES: window.GLHelpValidator
 */

(function() {
  'use strict';

  // UI contracts embedded for validation
  var CONTRACTS = {
    setlists: { ctaLabels: ['+ New Setlist', 'Save Setlist'], emptyText: 'No setlists yet', selectors: ['#setlistsList', '#slStickyFooter'] },
    songs: { ctaLabels: ['Create a Setlist', '+ Add a song manually'], emptyText: 'No songs yet', selectors: ['#songDropdown'] },
    home: { ctaLabels: ['Pick Songs', 'Start Rehearsal', 'Rate It'], emptyText: '', selectors: ['#page-home'] }
  };

  /**
   * Validate a page's UI against its contract.
   * Returns list of issues found.
   */
  function validatePage(pageName) {
    var contract = CONTRACTS[pageName];
    if (!contract) return [{ type: 'missing_contract', message: 'No UI contract for page: ' + pageName }];

    var issues = [];
    var pageEl = document.getElementById('page-' + pageName);
    if (!pageEl) {
      issues.push({ type: 'page_not_visible', message: 'Page element not found: #page-' + pageName });
      return issues;
    }

    var pageText = pageEl.textContent || '';

    // Check CTA labels
    (contract.ctaLabels || []).forEach(function(label) {
      if (pageText.indexOf(label) < 0) {
        // Check buttons specifically
        var buttons = pageEl.querySelectorAll('button');
        var found = false;
        buttons.forEach(function(btn) { if ((btn.textContent || '').indexOf(label) >= 0) found = true; });
        if (!found) issues.push({ type: 'missing_cta', message: 'CTA not found: "' + label + '"', page: pageName });
      }
    });

    // Check selectors
    (contract.selectors || []).forEach(function(sel) {
      if (!document.querySelector(sel)) {
        issues.push({ type: 'missing_selector', message: 'Selector not found: ' + sel, page: pageName });
      }
    });

    return issues;
  }

  /**
   * Run full validation across all contracted pages.
   */
  function validateAll() {
    var report = { timestamp: new Date().toISOString(), pages: {}, totalIssues: 0 };
    Object.keys(CONTRACTS).forEach(function(page) {
      var issues = validatePage(page);
      report.pages[page] = { issues: issues, valid: issues.length === 0 };
      report.totalIssues += issues.length;
    });
    console.log('[HelpValidator] Report:', report);
    return report;
  }

  window.GLHelpValidator = {
    validatePage: validatePage,
    validateAll: validateAll
  };

  console.log('\u2705 GLHelpValidator loaded');
})();

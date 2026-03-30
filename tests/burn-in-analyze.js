#!/usr/bin/env node
/**
 * Analyzes burn-in-results.json and produces a ranked stability report.
 * Run: node tests/burn-in-analyze.js
 */
const fs = require('fs');
const path = require('path');

const resultsPath = path.join(__dirname, 'burn-in-results.json');
if (!fs.existsSync(resultsPath)) {
  console.log('No results file found. Run the burn-in first.');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
const suites = data.suites || [];

// Flatten all test results
var allTests = [];
function extractTests(suite) {
  (suite.specs || []).forEach(function(spec) {
    (spec.tests || []).forEach(function(test) {
      (test.results || []).forEach(function(result) {
        allTests.push({
          title: spec.title,
          suite: suite.title,
          project: test.projectName,
          status: result.status, // 'passed' | 'failed' | 'timedOut' | 'skipped'
          duration: result.duration,
          error: result.error ? result.error.message : null,
          annotations: result.annotations || [],
        });
      });
    });
  });
  (suite.suites || []).forEach(extractTests);
}
suites.forEach(extractTests);

var total = allTests.length;
var passed = allTests.filter(t => t.status === 'passed').length;
var failed = allTests.filter(t => t.status === 'failed' || t.status === 'timedOut').length;
var skipped = allTests.filter(t => t.status === 'skipped').length;

console.log('═══════════════════════════════════════════════');
console.log('BURN-IN STABILITY REPORT');
console.log('═══════════════════════════════════════════════');
console.log('Total runs:', total);
console.log('Passed:', passed, '(' + (total ? Math.round(passed/total*100) : 0) + '%)');
console.log('Failed:', failed, '(' + (total ? Math.round(failed/total*100) : 0) + '%)');
console.log('Skipped:', skipped);
console.log('');

// Group failures by test name
var failureMap = {};
allTests.filter(t => t.status === 'failed' || t.status === 'timedOut').forEach(function(t) {
  var key = t.project + ' › ' + t.suite + ' › ' + t.title;
  if (!failureMap[key]) failureMap[key] = { count: 0, errors: [], durations: [] };
  failureMap[key].count++;
  if (t.error) failureMap[key].errors.push(t.error.substring(0, 200));
  failureMap[key].durations.push(t.duration);
});

var ranked = Object.entries(failureMap).sort((a,b) => b[1].count - a[1].count);

if (ranked.length === 0) {
  console.log('✅ NO FAILURES across all iterations!');
} else {
  console.log('TOP FLAKY TESTS (by failure count):');
  console.log('───────────────────────────────────────────────');
  ranked.slice(0, 15).forEach(function(entry, i) {
    var name = entry[0];
    var info = entry[1];
    var totalForTest = allTests.filter(t => (t.project + ' › ' + t.suite + ' › ' + t.title) === name).length;
    var pct = Math.round(info.count / totalForTest * 100);
    console.log((i+1) + '. ' + name);
    console.log('   Failures: ' + info.count + '/' + totalForTest + ' (' + pct + '%)');
    // Categorize root cause
    var topError = info.errors[0] || '';
    var cause = 'unknown';
    if (topError.indexOf('waitForFunction') !== -1 || topError.indexOf('Timeout') !== -1) cause = 'async data delay';
    else if (topError.indexOf('not found') !== -1 || topError.indexOf('null') !== -1) cause = 'selector mismatch';
    else if (topError.indexOf('toBeVisible') !== -1) cause = 'navigation/render race';
    else if (topError.indexOf('toContain') !== -1 || topError.indexOf('toMatch') !== -1) cause = 'stale state';
    else if (topError.indexOf('click') !== -1) cause = 'broken interaction';
    console.log('   Likely cause: ' + cause);
    console.log('   Sample error: ' + topError.substring(0, 150));
    console.log('');
  });
}

// Timing analysis
var bootTimes = allTests.filter(t => t.annotations.some(a => a.type === 'bootMs')).map(function(t) {
  var ann = t.annotations.find(a => a.type === 'bootMs');
  return parseInt(ann.description) || 0;
}).filter(Boolean);

var navTimes = allTests.filter(t => t.annotations.some(a => a.type === 'navMs')).map(function(t) {
  var ann = t.annotations.find(a => a.type === 'navMs');
  return parseInt(ann.description) || 0;
}).filter(Boolean);

if (bootTimes.length) {
  bootTimes.sort((a,b) => a-b);
  console.log('BOOT TIMING:');
  console.log('  Median:', bootTimes[Math.floor(bootTimes.length/2)] + 'ms');
  console.log('  P95:', bootTimes[Math.floor(bootTimes.length*0.95)] + 'ms');
  console.log('  Max:', bootTimes[bootTimes.length-1] + 'ms');
  console.log('');
}

if (navTimes.length) {
  navTimes.sort((a,b) => a-b);
  console.log('NAVIGATION TIMING:');
  console.log('  Median:', navTimes[Math.floor(navTimes.length/2)] + 'ms');
  console.log('  P95:', navTimes[Math.floor(navTimes.length*0.95)] + 'ms');
  console.log('  Max:', navTimes[navTimes.length-1] + 'ms');
  console.log('');
}

console.log('═══════════════════════════════════════════════');
console.log('Report generated:', new Date().toISOString());

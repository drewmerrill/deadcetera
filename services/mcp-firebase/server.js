#!/usr/bin/env node
/**
 * GrooveLinx Firebase MCP Server
 * ─────────────────────────────────────────────────────────────────────────
 * Exposes the GrooveLinx Firebase Realtime Database to Claude Code (or any
 * MCP-compatible agent) via stdio transport. Lets Claude read/write band
 * data directly during a session instead of generating console snippets for
 * Drew to paste into DevTools.
 *
 * SECURITY POSTURE
 *
 * This server uses a Firebase Admin SDK service-account key, which has
 * FULL READ/WRITE access to the entire `bands/` tree (and all other paths).
 * Treat the credentials file like a production secret:
 *   - Never commit it to git (.gitignore excludes `service-account*.json`)
 *   - Don't share the file
 *   - Rotate via Firebase Console → Project Settings → Service Accounts if
 *     it's ever exposed
 *
 * The server enforces:
 *   - A `BAND_SCOPE` whitelist — only paths under `bands/<allowed-slug>/*`
 *     are mutable. Reads can go anywhere; writes/deletes refuse paths
 *     outside the scope. Set ALLOWED_BAND_SLUGS env var (comma-separated)
 *     to control which bands can be written.
 *   - A `DELETE_GUARDS` blocklist — refuses delete on root, on `bands/`,
 *     on `bands/{slug}/`, and on `meta/members` (catches obvious foot-guns).
 *
 * USAGE
 *
 *   Set env vars:
 *     FIREBASE_SERVICE_ACCOUNT_PATH=/abs/path/to/service-account.json
 *     FIREBASE_DATABASE_URL=https://your-project.firebaseio.com  (or .firebasedatabase.app)
 *     ALLOWED_BAND_SLUGS=deadcetera                              (optional, default: '*' = all)
 *
 *   Configured in Claude Code via `.mcp.json` at repo root or in
 *   `~/.claude/settings.json`. See README.md.
 *
 * TOOLS EXPOSED
 *
 *   firebase_read(path)
 *   firebase_list_children(path)
 *   firebase_write(path, data)
 *   firebase_update(path, updates)   // multi-key shallow update
 *   firebase_delete(path)
 *   firebase_push(path, data)        // appendKey + write
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

// ── Config from env ─────────────────────────────────────────────────────────
const SVC_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const DB_URL = process.env.FIREBASE_DATABASE_URL;
const ALLOWED_SLUGS = (process.env.ALLOWED_BAND_SLUGS || '*')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

if (!SVC_PATH) {
    console.error('[mcp-firebase] FIREBASE_SERVICE_ACCOUNT_PATH env var required');
    process.exit(1);
}
if (!DB_URL) {
    console.error('[mcp-firebase] FIREBASE_DATABASE_URL env var required (e.g. https://groovelinx-app-default-rtdb.firebaseio.com)');
    process.exit(1);
}

// ── Firebase init ──────────────────────────────────────────────────────────
let serviceAccount;
try {
    serviceAccount = JSON.parse(readFileSync(SVC_PATH, 'utf-8'));
} catch (e) {
    console.error('[mcp-firebase] Failed to read service account file at', SVC_PATH, ':', e.message);
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: DB_URL,
});
const db = admin.database();

// ── Safety: write/delete scope enforcement ─────────────────────────────────
const DELETE_BLOCKLIST = new Set(['/', '', 'bands', 'bands/', 'users', 'users/']);

function normalizePath(p) {
    if (!p || typeof p !== 'string') throw new Error('path must be a non-empty string');
    return p.replace(/^\/+/, '').replace(/\/+$/, ''); // strip leading/trailing slashes
}

function assertWriteAllowed(path) {
    const norm = normalizePath(path);
    if (ALLOWED_SLUGS.includes('*')) return; // unrestricted
    // Must be under bands/<allowed-slug>/...
    const m = norm.match(/^bands\/([^/]+)/);
    if (!m) throw new Error(`Write outside bands/* refused (path=${norm}). Set ALLOWED_BAND_SLUGS=* to permit.`);
    if (!ALLOWED_SLUGS.includes(m[1])) {
        throw new Error(`Write to band "${m[1]}" not in ALLOWED_BAND_SLUGS=[${ALLOWED_SLUGS.join(',')}]`);
    }
}

function assertDeleteAllowed(path) {
    const norm = normalizePath(path);
    if (DELETE_BLOCKLIST.has(norm) || DELETE_BLOCKLIST.has(norm + '/')) {
        throw new Error(`Delete on protected path "${norm}" refused (root, bands/, users/, etc.)`);
    }
    // Refuse deleting an entire band root or meta/members (would wipe all members)
    if (/^bands\/[^/]+\/?$/.test(norm)) {
        throw new Error(`Delete of entire band root "${norm}" refused — too destructive. Delete child paths instead.`);
    }
    if (/^bands\/[^/]+\/meta\/members\/?$/.test(norm)) {
        throw new Error(`Delete of entire meta/members "${norm}" refused — would wipe roster. Delete specific member keys instead.`);
    }
    assertWriteAllowed(path);
}

// ── MCP server ─────────────────────────────────────────────────────────────
const server = new Server(
    { name: 'groovelinx-mcp-firebase', version: '1.0.0' },
    { capabilities: { tools: {} } }
);

const tools = [
    {
        name: 'firebase_read',
        description: 'Read data at a Firebase Realtime Database path. Returns the entire subtree at that path as JSON. Use for inspecting current state (e.g. firebase_read("bands/deadcetera/gigs") to see all gigs).',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Firebase RTDB path, e.g. "bands/deadcetera/gigs" or "bands/deadcetera/meta/members/drew"' },
            },
            required: ['path'],
        },
    },
    {
        name: 'firebase_list_children',
        description: 'List the immediate child keys at a Firebase path (does not return values). Faster than firebase_read when you only need to know what keys exist. Returns array of key names.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Firebase RTDB path whose child keys to list' },
            },
            required: ['path'],
        },
    },
    {
        name: 'firebase_write',
        description: 'Overwrite data at a path with the provided JSON value. WARNING: this replaces the entire subtree at that path. Use firebase_update for targeted multi-key changes. Subject to ALLOWED_BAND_SLUGS scope.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Target Firebase path (must be under bands/<allowed-slug>/...)' },
                data: { description: 'JSON value to write. Can be primitive, object, array.' },
            },
            required: ['path', 'data'],
        },
    },
    {
        name: 'firebase_update',
        description: 'Shallow multi-key update at a path. Only the keys present in `updates` are modified; siblings are untouched. Safer than firebase_write for partial changes. Subject to ALLOWED_BAND_SLUGS scope.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Target Firebase path' },
                updates: { type: 'object', description: 'Object whose keys are the (relative) child paths to update' },
            },
            required: ['path', 'updates'],
        },
    },
    {
        name: 'firebase_delete',
        description: 'Remove the data at a path entirely. Refuses dangerous paths (root, bands/, meta/members/, etc.). Subject to ALLOWED_BAND_SLUGS scope.',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Path to delete' },
            },
            required: ['path'],
        },
    },
    {
        name: 'firebase_push',
        description: 'Append a new auto-keyed child under `path` with the given data. Returns the generated key. Use when adding a new item to a list-like node (e.g. a new notification).',
        inputSchema: {
            type: 'object',
            properties: {
                path: { type: 'string', description: 'Parent path' },
                data: { description: 'Data to write under the new auto-generated key' },
            },
            required: ['path', 'data'],
        },
    },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
        switch (name) {
            case 'firebase_read': {
                const path = normalizePath(args.path);
                const snap = await db.ref(path).once('value');
                return { content: [{ type: 'text', text: JSON.stringify(snap.val(), null, 2) }] };
            }
            case 'firebase_list_children': {
                const path = normalizePath(args.path);
                const snap = await db.ref(path).once('value');
                const val = snap.val();
                if (val === null || typeof val !== 'object') {
                    return { content: [{ type: 'text', text: JSON.stringify([]) }] };
                }
                return { content: [{ type: 'text', text: JSON.stringify(Object.keys(val)) }] };
            }
            case 'firebase_write': {
                assertWriteAllowed(args.path);
                const path = normalizePath(args.path);
                await db.ref(path).set(args.data);
                return { content: [{ type: 'text', text: `✓ wrote ${path}` }] };
            }
            case 'firebase_update': {
                assertWriteAllowed(args.path);
                const path = normalizePath(args.path);
                await db.ref(path).update(args.updates);
                return { content: [{ type: 'text', text: `✓ updated ${path} (${Object.keys(args.updates).length} keys)` }] };
            }
            case 'firebase_delete': {
                assertDeleteAllowed(args.path);
                const path = normalizePath(args.path);
                await db.ref(path).remove();
                return { content: [{ type: 'text', text: `✓ deleted ${path}` }] };
            }
            case 'firebase_push': {
                assertWriteAllowed(args.path);
                const path = normalizePath(args.path);
                const ref = await db.ref(path).push(args.data);
                return { content: [{ type: 'text', text: `✓ pushed ${path}/${ref.key}` }] };
            }
            default:
                return { content: [{ type: 'text', text: `unknown tool: ${name}` }], isError: true };
        }
    } catch (e) {
        return { content: [{ type: 'text', text: `[mcp-firebase] ${e.message}` }], isError: true };
    }
});

// ── Boot ───────────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[mcp-firebase] ready · scope=', ALLOWED_SLUGS.join(','), '· db=', DB_URL);

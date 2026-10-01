// ===== Model registry =====
// Built-in samples live in models/samples/ (updated with the repo).
// YOUR models live in workspace/models.js (git-ignored, never overwritten by `git pull`) — copy workspace.example/ to workspace/ to start.
import * as sword from './samples/sword.js';
import * as shield from './samples/shield.js';
import * as lever from './samples/lever.js';

export const SAMPLES = [sword, shield, lever];

let user = [];
try{ user = (await import('../workspace/models.js')).MODELS || []; }
catch(e){ if(!/Failed to fetch|Cannot find|404|Importing a module script failed/i.test(e.message)) console.warn('workspace/models.js:', e); }
export const USER = user;
export const MODELS = [...USER, ...SAMPLES];

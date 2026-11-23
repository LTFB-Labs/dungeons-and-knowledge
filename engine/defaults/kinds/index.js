// @ts-check
// The default kinds of things, described in data. A map names them in its `things` ({ kind: 'torch', at: ... }).
// A game hands KINDS to createGame in `kinds`, with its own beside them.
import { GOBLIN_KINDS } from './goblins.js';
import { HALL_KINDS } from './hall.js';
import { STORE_KINDS } from './store.js';

export const KINDS = { ...STORE_KINDS, ...HALL_KINDS, ...GOBLIN_KINDS };

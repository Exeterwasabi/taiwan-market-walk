import {test} from 'node:test';import assert from 'node:assert/strict';import {normalize} from '../scripts/normalize.mjs';
const event={EventID:'1',EventName:'農夫市集',Description:'test',PostalAddress:{City:'台北市'},StartDateTime:'2026-10-17T09:00:00+08:00',EndDateTime:'2026-10-18T17:00:00+08:00',Images:[{URL:'javascript:bad'}]};
test('normalizes and deduplicates real feed schema',()=>{const r=normalize({Events:[event,event]});assert.equal(r.events.length,1);assert.equal(r.events[0].city,'臺北市');assert.equal(r.events[0].images.length,0);assert.equal(r.events[0].type,'農夫市集');});
test('reject abnormal dates and malformed feed',()=>{assert.equal(normalize({Events:[{...event,EndDateTime:'2126-10-18'}]}).rejected,1);assert.throws(()=>normalize({}));});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {weekend,taipeiDate,filterEvents,safeUrl} from '../src/domain.js';
test('Sunday stays in same weekend and Monday advances',()=>{assert.deepEqual(weekend('2026-10-18'),{start:'2026-10-17',end:'2026-10-18'});assert.equal(weekend('2026-10-19').start,'2026-10-24');});
test('Taiwan timezone crosses UTC date boundary',()=>assert.equal(taipeiDate('2026-10-16T16:30:00Z'),'2026-10-17'));
test('date overlap and county filtering',()=>{const e={name:'市集',city:'臺北市',start:'2026-09-30',end:'2026-10-18'};assert.equal(filterEvents([e],{start:'2026-10-17',end:'2026-10-18'}).length,1);assert.equal(filterEvents([e],{city:'新北市'}).length,0);assert.equal(filterEvents([e],{start:'2026-10-19'}).length,0);});
test('reject unsafe links',()=>{assert.equal(safeUrl('javascript:alert(1)'),'');assert.equal(safeUrl('https://example.com'),'https://example.com/');});

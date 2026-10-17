import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeEvents,mergeSources} from '../src/merge.js';
const e={id:'a',name:'市集',start:'2026-10-17',end:'2026-10-18',source:'https://example.org/news',city:'臺北市'};
test('query preserves missing unexpired activities and keeps today',()=>{
 assert.deepEqual(mergeEvents([e],[],'2026-10-18'),[e]);
 assert.deepEqual(mergeEvents([e],[],'2026-10-19'),[]);
});
test('updates merge by id; expired incoming cannot resurrect',()=>{
 assert.equal(mergeEvents([e],[{...e,name:'新名稱'}],'2026-10-18')[0].name,'新名稱');
 assert.equal(mergeEvents([],[e],'2026-10-19').length,0);
});
test('sparse sessions prune only dates before query day, without mutation',()=>{
 const event={...e,sessions:[{date:'2026-10-17'},{date:'2026-10-24'}]};
 const result=mergeEvents([event],[],'2026-10-18')[0];
 assert.equal(result.start,'2026-10-24');assert.equal(result.sessions.length,1);assert.equal(event.sessions.length,2);
});
test('older snapshots and unverified candidates cannot downgrade announcements',()=>{
 const old={...e,verification:'announcement',updated:'2026-10-17T10:00:00Z'};
 assert.equal(mergeEvents([old],[{...e,name:'候選'}],'2026-10-17')[0].name,e.name);
 assert.equal(mergeEvents([old],[{...old,name:'過時',updated:'2026-10-16T10:00:00Z'}],'2026-10-17')[0].name,e.name);
});
test('fixed sources survive event expiry and repeated registration',()=>{
 const sources=mergeSources([], [e]);
 assert.deepEqual(mergeSources(sources,[]),sources);
 assert.deepEqual(mergeSources(sources,[e]),sources);
});

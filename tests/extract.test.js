import test from 'node:test';
import assert from 'node:assert/strict';
import {extractEvents} from '../worker/extract.js';
import {reconcile} from '../worker/reconcile.js';
const source={id:'official',url:'https://example.org/market',label:'主辦'};
const item={'@type':'Event',name:'小農市集',startDate:'2026-10-18',location:{address:{addressRegion:'台北市',streetAddress:'測試路1號'}}};
const html=value=>`<script type="application/ld+json">${JSON.stringify(value)}</script>`;
test('extracts explicit structured dates, normalizes city, and ignores unsafe images',()=>{
 const [event]=extractEvents(html({...item,image:['javascript:alert(1)','https://example.org/photo.jpg']}),source,'2026-10-17T10:00:00Z');
 assert.equal(event.city,'臺北市');assert.equal(event.sessions[0].date,'2026-10-18');assert.equal(event.images.length,1);
});
test('plain text dates are not guessed; missing place is rejected',()=>{
 assert.deepEqual(extractEvents('每週末舉辦市集',source,''),[]);
 assert.deepEqual(extractEvents(html({...item,location:{}}),source,''),[]);
});
test('multi-day Event remains candidate rather than inventing daily sessions',()=>{
 const [event]=extractEvents(html({...item,endDate:'2026-11-18'}),source,'');
 assert.equal(event.verification,'candidate');assert.equal(event.sessions,undefined);
});
test('known single-event source reconciles changed title while keeping other dates and DM',()=>{
 const old={id:'reviewed',source:source.url,city:'新竹市',verification:'announcement',sessions:[{date:'2026-10-17'},{date:'2026-10-18'},{date:'2026-10-24'}],images:[{url:'https://example.org/dm.jpg',kind:'dm'}]};
 const incoming={id:'new',source:source.url,name:'改名',city:'新竹市',sessions:[{date:'2026-10-18',time:'12:00'}],images:[]};
 const [event]=reconcile([old],[incoming],{...source,eventIds:['reviewed']});
 assert.equal(event.id,'reviewed');assert.equal(event.sessions.length,3);assert.equal(event.images[0].kind,'dm');
});

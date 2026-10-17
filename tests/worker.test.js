import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import worker,{MarketStore} from '../worker/index.js';
function state(){
 const db=new DatabaseSync(':memory:');
 return {blockConcurrencyWhile:fn=>fn(),storage:{
  sql:{exec(sql,...args){const statement=db.prepare(sql);return {toArray:()=>statement.all(...args),...(!sql.startsWith('SELECT')?(statement.run(...args),{}):{})};}},
  transactionSync:fn=>fn(),setAlarm:async()=>{}
 }};
}
test('source failure preserves old event and fixed source; expired event removed',async()=>{
 const object=new MarketStore(state());
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
 const event={id:'retained',name:'市集',start:today,end:today};
 object.write({sources:[{id:'test',url:'https://example.org/source'}],snapshot:{events:[event,{...event,id:'expired',end:'2020-01-01'}]},job:{state:'running',done:0,total:1,added:0,failed:0,review:0,parsed:0}});
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});
 try{await object.alarm();}finally{globalThis.fetch=original;}
 assert.deepEqual(object.read('snapshot').events,[event]);
 assert.equal(object.read('sources')[0].lastResult,'failed');
 assert.equal(object.read('job').state,'complete');
});
test('worker stores snapshots larger than Durable Object KV value limit',()=>{
 const object=new MarketStore(state()),value={description:'市集'.repeat(150000)};
 object.write({snapshot:value});assert.deepEqual(object.read('snapshot'),value);
});
test('untrusted origin cannot trigger source requests',async()=>{
 const response=await worker.fetch(new Request('https://worker.test/query',{method:'POST',headers:{Origin:'https://other.test'}}),{});
 assert.equal(response.status,403);
});

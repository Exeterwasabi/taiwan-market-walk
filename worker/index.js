import {mergeEvents,mergeSources} from '../src/merge.js';
import {taipeiDate} from '../src/domain.js';
import {extractEvents} from './extract.js';
import {readEventZip} from './zip.js';
import {normalize} from '../scripts/normalize.mjs';
import {reconcile} from './reconcile.js';
const site='https://exeterwasabi.github.io/taiwan-market-walk/';
const allowed=new Set(['https://exeterwasabi.github.io','http://localhost:4173']);
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function get(url){
 const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'TaiwanMarketWalk/1.0 (+https://exeterwasabi.github.io/taiwan-market-walk/)'}});
 if(!response.ok)throw Error('HTTP '+response.status);
 return response;
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin');
  if(origin&&!allowed.has(origin))return json({error:'Origin not allowed'},403);
  const path=new URL(request.url).pathname;
  if(!['/query','/status','/events','/sources'].includes(path))return json({error:'Not found'},404);
  const headers={'Access-Control-Allow-Origin':origin||'https://exeterwasabi.github.io','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!==(path==='/query'?'POST':'GET'))return json({error:'Method not allowed'},405);
  try{
   const response=await env.MARKETS.get(env.MARKETS.idFromName('public-markets')).fetch(request);
   return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}});
  }catch{return new Response(JSON.stringify({error:'查詢服務暫時無法使用，舊資料已保留'}),{status:503,headers:{...headers,'Content-Type':'application/json'}});}
 }
};

export class MarketStore {
 constructor(state){
  this.state=state;
  state.storage.sql.exec('CREATE TABLE IF NOT EXISTS documents (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
 }
 read(key){const rows=this.state.storage.sql.exec('SELECT value FROM documents WHERE key = ?',key).toArray();return rows.length?JSON.parse(rows[0].value):undefined;}
 write(values){this.state.storage.transactionSync(()=>{for(const [key,value] of Object.entries(values))this.state.storage.sql.exec('INSERT OR REPLACE INTO documents (key,value) VALUES (?,?)',key,JSON.stringify(value));});}
 async fetch(request){
  const path=new URL(request.url).pathname;
  if(path==='/query')return this.state.blockConcurrencyWhile(async()=>{
   let job=this.read('job');
   if(job?.state==='running')return json(job,202);
   if(job&&Date.now()-Date.parse(job.startedAt)<60000)return json({...job,reused:true});
   // The only seed URLs are compiled constants; callers cannot submit fetch URLs.
   const [published,registry]=await Promise.all([(await get(site+'public/data/events.json')).json(),(await get(site+'public/data/sources.json')).json()]);
   if(!Array.isArray(published.events)||!Array.isArray(registry.sources))throw Error('Invalid seed');
   const old=this.read('snapshot');
   const previousSources=this.read('sources')||[];
   const byUrl=new Map(previousSources.map(s=>[s.url,s]));
   for(const source of registry.sources)byUrl.set(source.url,{...byUrl.get(source.url),...source});
   const sources=[...byUrl.values()];
   const events=mergeEvents(old?.events||[],published.events);
   const fixed=mergeSources(sources,events);
   job={id:crypto.randomUUID(),state:'running',startedAt:new Date().toISOString(),queryDate:taipeiDate(),done:0,total:fixed.length,added:0,parsed:0,review:0,failed:0};
   this.write({snapshot:{...published,events},sources:fixed,job});
   await this.state.storage.setAlarm(Date.now()+1000);
   return json(job,202);
  });
  if(path==='/status')return json(this.read('job')||{state:'idle'});
  if(path==='/sources')return json({sources:this.read('sources')||[]});
  const snapshot=this.read('snapshot');
  if(snapshot){
   const sources=this.read('sources')||[];
   const fixes=snapshot.events.filter(e=>e.id.startsWith('structured:')).flatMap(e=>reconcile(snapshot.events,[e],sources.find(s=>s.url===e.source)||{}));
   const removed=fixes.reduce((n,e)=>n+(e.replaces||[]).filter(id=>snapshot.events.some(old=>old.id===id)).length,0);
   snapshot.events=mergeEvents(snapshot.events,fixes);
   this.write({snapshot});
   if(removed){const job=this.read('job');if(job){job.added=Math.max(0,job.added-removed);this.write({job});}}
  }
  return snapshot?json({...snapshot,events:mergeEvents(snapshot.events,[])}):json({error:'尚未查詢'},404);
 }
 async alarm(){
  const job=this.read('job');if(job?.state!=='running')return;
  const sources=this.read('sources');
  const snapshot=this.read('snapshot');
  // Small batches stay below free-plan subrequest limits. A persisted cursor resumes retries.
  await Promise.all(sources.slice(job.done,job.done+3).map(async source=>{
   const checkedAt=new Date().toISOString();
   try{
    if(source.adapter==='tourism-zip'){
     const response=await get(source.url);
     const feed=await readEventZip(await response.arrayBuffer());
     const incoming=normalize(feed).events.map(e=>({...e,verification:'candidate',needsCheck:true}));
     if(!incoming.length)throw Error('來源無市集資料，需人工檢查');
     const before=new Set(snapshot.events.map(e=>e.id));
     snapshot.events=mergeEvents(snapshot.events,incoming);
     job.added+=snapshot.events.filter(e=>!before.has(e.id)).length;
     const registered=mergeSources(sources,incoming);
     const known=new Set(sources.map(s=>s.url));sources.push(...registered.filter(s=>!known.has(s.url)));job.total=sources.length;
     source.lastResult='parsed';source.note='已重新擷取並解析觀光署活動資料';job.parsed++;
    }else{
     const response=await get(source.url);
     const type=response.headers.get('content-type')||'';
     if(!/text\/html/.test(type))throw Error('非 HTML 公告，需人工查核');
     const reader=response.body.getReader();let length=0;const chunks=[];
     for(;;){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>2_000_000){await reader.cancel();throw Error('公告超過讀取上限');}chunks.push(value);}
     const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
     const html=new TextDecoder().decode(bytes);
     const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
     const incoming=reconcile(snapshot.events,extractEvents(html,source,checkedAt),source);
     const before=new Set(snapshot.events.map(e=>e.id));
     snapshot.events=mergeEvents(snapshot.events,incoming,taipeiDate());
     job.added+=snapshot.events.filter(e=>!before.has(e.id)).length;
     source.changed=!!source.digest&&source.digest!==digest;source.digest=digest;
     source.lastResult=incoming.length?'parsed':'needs-review';
     source.note=incoming.length?'已解析明列日期的 Event 結構化資料':'頁面已讀取，無可安全解析的市集場次；保留原資料，需人工查核';
     if(incoming.length)job.parsed++;else job.review++;
    }
   }catch(error){source.lastResult='failed';source.note=error.message;job.failed++;}
   source.lastAttemptAt=checkedAt;job.done++;
  }));
  snapshot.events=mergeEvents(snapshot.events,[],taipeiDate());
  if(job.done>=job.total){job.state='complete';job.completedAt=new Date().toISOString();snapshot.queriedAt=job.completedAt;}
  this.write({sources,snapshot,job});
  if(job.state==='running')await this.state.storage.setAlarm(Date.now()+1000);
 }
}

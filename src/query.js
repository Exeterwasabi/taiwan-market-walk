import {safeUrl} from './domain.js';
import {mergeEvents} from './merge.js';
let apiBase='';
const config=fetch('./public/query-config.json',{cache:'no-store'}).then(r=>r.json()).then(c=>{if(c.apiBase&&/^https:\/\//.test(c.apiBase))apiBase=c.apiBase.replace(/\/$/,'');}).catch(()=>{});
async function request(path,options={}){
 const response=await fetch(apiBase+path,{...options,cache:'no-store',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('服務回應 '+response.status);
 return response.json();
}
export async function latestSnapshot(){
 try{await config;if(!apiBase)return null;const r=await fetch(apiBase+'/events',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!r.ok)return null;const data=await r.json();return Array.isArray(data.events)?data:null;}catch{return null;}
}
export async function showSources(remote=false){
 const root=document.querySelector('#sources');
 try{
  await config;
  const data=remote&&apiBase?await request('/sources'):await fetch('./public/data/sources.json',{cache:'no-cache'}).then(r=>r.json());
  root.replaceChildren();
  for(const source of data.sources){
   const row=document.createElement('p'),a=document.createElement('a');
   a.textContent=source.label||source.url;a.href=safeUrl(source.url);a.target='_blank';a.rel='noopener noreferrer';row.append(a);
   const labels={parsed:'已解析', 'needs-review':'需人工查核',failed:'讀取失敗'};
   row.append(document.createTextNode(' ｜ '+(labels[source.lastResult]||'尚未即時查詢')+(source.lastAttemptAt?' ｜ '+new Date(source.lastAttemptAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'')+(source.note?' ｜ '+source.note:'')));
   root.append(row);
  }
 }catch{root.textContent='暫時無法讀取固定來源清單。';}
}
export async function querySources({current,accept}){
 const button=document.querySelector('#refresh'),notice=document.querySelector('#notice');
 button.disabled=true;button.textContent='查詢中…';
 accept({...current(),events:mergeEvents(current().events,[])});
 try{
  await config;
  if(!apiBase)throw Error('雲端查詢服務尚未完成部署；已清除過期活動，現有未過期活動保留');
  if(!navigator.onLine)throw Error('目前離線，無法查詢各來源；未過期活動保留');
  let job=await request('/query',{method:'POST'});
  const deadline=Date.now()+8*60*1000;
  while(job.state==='running'){
   notice.textContent=`正在查詢固定來源 ${job.done} / ${job.total}；已解析 ${job.parsed}，需人工查核 ${job.review}，讀取失敗 ${job.failed}。未過期活動會保留。`;
   if(Date.now()>deadline)throw Error('雲端仍在查詢，稍後再按「查詢」可接續查看結果');
   await new Promise(resolve=>setTimeout(resolve,3000));
   job=await request('/status');
  }
  if(job.state!=='complete')throw Error('查詢尚未完成');
  accept(await request('/events'));
  job=await request('/status');
  notice.textContent=`${job.reused?'顯示一分鐘內的查詢結果':'查詢完成'}：${job.done} 個來源；已解析 ${job.parsed}，需人工查核 ${job.review}，讀取失敗 ${job.failed}。已刪除台灣今日以前結束的活動；當日與未來活動保留。`;
  await showSources(true);
 }catch(error){notice.textContent=error.message+'。';}
 finally{button.disabled=false;button.textContent='查詢';}
}

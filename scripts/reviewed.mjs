import {cities,safeUrl} from '../src/domain.js';
export function mergeReviewed(base,reviewed){
 if(!Array.isArray(reviewed.events))throw Error('人工場次格式錯誤');
 const ids=new Set();
 const additions=reviewed.events.map(e=>{
  if(!e.id||ids.has(e.id)||!cities.includes(e.city)||!safeUrl(e.source)||!e.evidence||!Number.isFinite(Date.parse(e.checkedAt))||!Array.isArray(e.sessions)||!e.sessions.length)throw Error('人工場次欄位不完整：'+e.id);
  ids.add(e.id);
  for(const s of e.sessions)if(!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!Number.isFinite(Date.parse(s.date))||new Date(s.date).toISOString().slice(0,10)!==s.date)throw Error('場次日期錯誤：'+e.id);
  const sessions=[...e.sessions].sort((a,b)=>a.date.localeCompare(b.date));
  return {...e,sessions,start:sessions[0].date,end:sessions.at(-1).date,startTime:'請見公告場次',endTime:'請見公告場次',updated:e.checkedAt,needsCheck:false,verification:'announcement',images:(e.images||[]).filter(i=>safeUrl(i.url))};
 });
 const replaced=new Set(additions.flatMap(e=>[e.id,...(e.replaces||[])]));
 return [...base.filter(e=>!replaced.has(e.id)).map(e=>({...e,needsCheck:true,verification:'candidate'})),...additions];
}

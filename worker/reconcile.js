import {mergeEvents} from '../src/merge.js';
const manual=e=>e?.verification==='announcement'&&!!e.evidence&&!e.id.startsWith('structured:');
export function mergePublished(previous,published,today){
 const authoritative=new Set(published.filter(manual).map(e=>e.id));
 const restored=published.map(e=>{
  const old=previous.find(o=>o.id===e.id);
  return manual(e)&&['EventCancelled','EventPostponed'].includes(old?.status)&&Date.parse(old.updated||old.checkedAt)>Date.parse(e.checkedAt)?{...e,status:old.status,updated:old.updated}:e;
 });
 return mergeEvents(previous.filter(e=>!authoritative.has(e.id)),restored,today);
}
export function reconcile(events,incoming,source){
 return incoming.map(event=>{
  const known=(source.eventIds||[]).filter(id=>!id.startsWith('structured:'));
  const old=events.find(e=>known.length===1&&known[0]===e.id&&e.source===event.source&&e.city===event.city&&
   e.verification==='announcement'&&e.sessions?.some(s=>event.sessions?.some(n=>n.date===s.date)))||
   events.find(e=>e.source===event.source&&e.name===event.name&&e.start===event.start);
  if(!old)return event;
  // Structured event hours can describe the whole festival rather than its market.
  // Preserve reviewed details and the real human check time; source attempts live separately.
  if(manual(old))return {...old,status:['EventCancelled','EventPostponed'].includes(event.status)?event.status:old.status,
   updated:['EventCancelled','EventPostponed'].includes(event.status)?event.updated:old.updated,
   replaces:[...new Set([...(old.replaces||[]),...(event.replaces||[]),...(old.id!==event.id?[event.id]:[])])]};
  const sessions=old.sessions&&event.sessions?[...new Map([...old.sessions,...event.sessions].map(s=>[s.date,s])).values()].sort((a,b)=>a.date.localeCompare(b.date)):event.sessions;
  const images=[...new Map([...(event.images||[]),...(old.images||[])].map(i=>[i.url,i])).values()];
  return {...old,...event,id:old.id,replaces:[...new Set([...(event.replaces||[]),...(old.id!==event.id?[event.id]:[])])],images,...(sessions?{sessions,start:sessions[0].date,end:sessions.at(-1).date}:{})};
 });
}

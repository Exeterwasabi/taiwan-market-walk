import {taipeiDate} from './domain.js';

// Missing records are not deletions. Only an elapsed date expires an activity.
export function mergeEvents(previous, incoming, today=taipeiDate()) {
  const records=new Map(previous.map(e=>[e.id,e]));
  for(const event of incoming){
    for(const id of event.replaces||[])records.delete(id);
    const old=records.get(event.id);
    // A feed candidate must not silently undo a checked announcement.
    if(old?.verification==='announcement' && event.verification!=='announcement' && !['EventCancelled','EventPostponed'].includes(event.status))continue;
    const oldTime=Date.parse(old?.checkedAt||old?.updated||'');
    const newTime=Date.parse(event.checkedAt||event.updated||'');
    if(old && Number.isFinite(oldTime) && Number.isFinite(newTime) && oldTime>newTime)continue;
    records.set(event.id,event);
  }
  return [...records.values()].flatMap(e=>{
    if(Array.isArray(e.sessions)){
      const sessions=e.sessions.filter(s=>s.date>=today).sort((a,b)=>a.date.localeCompare(b.date));
      return sessions.length?[{...e,sessions,start:sessions[0].date,end:sessions.at(-1).date}]:[];
    }
    return e.end && e.end<today?[]:[e];
  });
}

export function mergeSources(previous,events){
  const sources=new Map(previous.map(s=>[s.url,s]));
  for(const e of events){
    for(const url of [e.source,e.venueSource].filter(Boolean)){
      if(!/^https?:\/\//.test(url))continue;
      const old=sources.get(url);
      sources.set(url,{id:old?.id||`source-${sources.size+1}`,url,label:old?.label||e.organizer||e.name,
        ...old,eventIds:[...new Set([...(old?.eventIds||[]),e.id])],
        cities:[...new Set([...(old?.cities||[]),e.city])],adapter:old?.adapter||'announcement'});
    }
  }
  return [...sources.values()];
}

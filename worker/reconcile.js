export function reconcile(events,incoming,source){
 return incoming.map(event=>{
  const old=events.find(e=>e.source===event.source&&e.name===event.name&&e.start===event.start)||events.find(e=>
   source.eventIds?.length===1&&source.eventIds[0]===e.id&&e.source===event.source&&e.city===event.city&&
   e.verification==='announcement'&&e.sessions?.some(s=>event.sessions?.some(n=>n.date===s.date)));
  if(!old)return event;
  const sessions=old.sessions&&event.sessions?[...new Map([...old.sessions,...event.sessions].map(s=>[s.date,s])).values()].sort((a,b)=>a.date.localeCompare(b.date)):event.sessions;
  const images=[...new Map([...(event.images||[]),...(old.images||[])].map(i=>[i.url,i])).values()];
  return {...old,...event,id:old.id,images,...(sessions?{sessions,start:sessions[0].date,end:sessions.at(-1).date}:{})};
 });
}

export const cities = ['臺北市','新北市','基隆市','桃園市','新竹市','新竹縣','苗栗縣','臺中市','彰化縣','南投縣','雲林縣','嘉義市','嘉義縣','臺南市','高雄市','屏東縣','宜蘭縣','花蓮縣','臺東縣','澎湖縣','金門縣','連江縣'];
export const taipeiDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export function weekend(day = taipeiDate()) {
  const d = new Date(day+'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6 - (d.getUTCDay() || 7));
  const start = d.toISOString().slice(0,10); d.setUTCDate(d.getUTCDate()+1);
  return {start,end:d.toISOString().slice(0,10)};
}
export function filterEvents(events,{city='',type='',query='',start='',end='',verifiedOnly=false}={}) {
  return events.filter(e=>(!city||e.city===city)&&(!type||e.type===type)&&(!verifiedOnly||isAnnounced(e))&&(e.sessions?e.sessions.some(s=>(!start||s.date>=start)&&(!end||s.date<=end)):(!start||e.end>=start)&&(!end||e.start<=end))&&(!query||`${e.name} ${e.address} ${e.description}`.includes(query))).sort((a,b)=>Number(!!a.needsCheck)-Number(!!b.needsCheck)||a.start.localeCompare(b.start));
}
export function safeUrl(value) { try { const u=new URL(value);return ['http:','https:'].includes(u.protocol)?u.href:''; } catch{return '';} }

export const isAnnounced=e=>e.verification==='announcement'&&Array.isArray(e.sessions)&&e.sessions.length>0&&!['EventCancelled','EventPostponed'].includes(e.status);


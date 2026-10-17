import {cities,safeUrl,taipeiDate} from '../src/domain.js';

export function extractEvents(html,source,checkedAt){
 const items=[];
 function visit(value){
  if(Array.isArray(value)){value.forEach(visit);return;}
  if(!value||typeof value!=='object')return;
  const types=[value['@type']].flat();
  if(types.some(t=>/^(Event|Festival|FoodEvent|SaleEvent)$/.test(t)))items.push(value);
  if(value['@graph'])visit(value['@graph']);
  if(value.subEvent)visit(value.subEvent);
 }
 for(const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){
  try{visit(JSON.parse(match[1]));}catch{}
 }
 return items.flatMap(item=>{
  const name=String(item.name||''),description=typeof item.description==='string'?item.description.replace(/<[^>]*>/g,' '):'';
  if(!/市集/.test(name+' '+description))return [];
  const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}/.test(value)&&Number.isFinite(Date.parse(value))?(value.length===10?value:taipeiDate(value)):'';
  const start=date(item.startDate),end=date(item.endDate||item.startDate);
  if(!start||!end||end<start)return [];
  const location=item.location?.address||{};
  const address=typeof location==='string'?location:[location.addressRegion,location.addressLocality,location.streetAddress].filter(Boolean).join('');
  const city=cities.find(c=>address.replaceAll('台','臺').includes(c));
  if(!city||!address)return [];
  const exact=start===end;
  const images=[item.image||[]].flat().map(i=>({url:safeUrl(typeof i==='string'?i:i?.url),name:'主辦來源圖片',kind:'image'})).filter(i=>i.url);
  const rawStatus=String(item.eventStatus||'EventScheduled').split('/').at(-1);
  return [{id:'structured:'+source.id+':'+encodeURIComponent(name+':'+start),name,description,city,
   type:/農夫|農民|小農/.test(name+' '+description)?'農夫市集':'假日／特色市集',start,end,
   startTime:item.startDate,endTime:item.endDate||'來源未提供',address,
   organizer:item.organizer?.name||source.label,source:source.url,images,status:rawStatus,
   updated:item.dateModified||checkedAt,checkedAt,needsCheck:!exact,verification:exact?'announcement':'candidate',
   ...(exact?{sessions:[{date:start,time:item.startDate.length>10?`${item.startDate} 至 ${item.endDate||'結束時間未提供'}`:'來源未提供時間'}]}:{}),
   evidence:'來源頁面內的 Event 結構化資料；多日活動仍待確認實際市集場次。'}];
 });
}

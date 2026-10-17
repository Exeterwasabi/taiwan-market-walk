import {cities,taipeiDate,safeUrl} from '../src/domain.js';
export function normalize(feed) {
  if(!Array.isArray(feed.Events)||!feed.Events.length) throw new Error('來源缺少 Events，保留舊資料');
  const result=new Map();let rejected=0;
  for(const e of feed.Events){
    if(!/市集/.test(`${e.EventName} ${e.Description}`))continue;
    const a=Date.parse(e.StartDateTime),b=Date.parse(e.EndDateTime);
    const city=(e.PostalAddress?.City||'').replace('台','臺');
    if(!e.EventID||!e.EventName||!cities.includes(city)||!Number.isFinite(a)||!Number.isFinite(b)||b<a||b-a>366*86400000){rejected++;continue;}
    const name=e.EventName,description=e.Description||'';
    result.set(e.EventID,{id:e.EventID,name,description,city,type:/農夫市集|農民市集|小農市集/.test(name+' '+description)?'農夫市集':'假日／特色市集',start:taipeiDate(a),end:taipeiDate(b),startTime:e.StartDateTime,endTime:e.EndDateTime,address:[city,e.PostalAddress?.Town,e.PostalAddress?.StreetAddress].filter(Boolean).join(''),organizer:(e.Organizations||[]).map(o=>o.Name).filter(Boolean).join('、')||'來源未提供',source:safeUrl(e.WebsiteURL)||'https://media.taiwan.net.tw/zh-tw/portal/travel?Keyword='+encodeURIComponent(name),images:(e.Images||[]).map(i=>({url:safeUrl(i.URL),name:i.Name||'來源活動圖片'})).filter(i=>i.url),status:e.EventStatus||'Unknown',updated:e.UpdateTime,needsCheck:! /市集/.test(name)||b-a>7*86400000});
  }
  const unique=new Map();
  for(const e of result.values()){
    const key=[e.name.replace(/[\s・．·｜|]/g,''),e.city,e.start,e.end].join('|');
    const previous=unique.get(key);
    if(!previous||Date.parse(e.updated)>Date.parse(previous.updated))unique.set(key,e);
  }
  return {events:[...unique.values()],rejected};
}

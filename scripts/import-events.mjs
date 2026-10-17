import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {normalize} from './normalize.mjs';
import {mergeReviewed} from './reviewed.mjs';
import {mergeEvents,mergeSources} from '../src/merge.js';
const url='https://media.taiwan.net.tw/XMLReleaseAll_public/v2.0/Zh_tw/Event-json.zip';
await mkdir('.cache/feed',{recursive:true});await mkdir('public/data',{recursive:true});
try {
 const response=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);
 await writeFile('.cache/events.zip',Buffer.from(await response.arrayBuffer()));
 if(process.platform==='win32')execFileSync('powershell.exe',['-NoProfile','-Command',"Add-Type -AssemblyName System.IO.Compression.FileSystem; $archive = [System.IO.Compression.ZipFile]::OpenRead((Join-Path (Get-Location) '.cache/events.zip')); try { $entry = $archive.GetEntry('EventList.json'); [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, (Join-Path (Get-Location) '.cache/feed/EventList.json'), $true) } finally { $archive.Dispose() }"]);
 else execFileSync('unzip',['-o','.cache/events.zip','-d','.cache/feed'],{stdio:'ignore'});
 const feed=JSON.parse((await readFile('.cache/feed/EventList.json','utf8')).replace(/^\uFEFF/,''));
 const normalized=normalize(feed); const rejected=normalized.rejected; const reviewed=JSON.parse(await readFile('public/data/reviewed.json','utf8')); const incoming=mergeReviewed(normalized.events,reviewed);if(!incoming.length)throw new Error('無市集候選資料，需人工檢查來源');
 let previous=JSON.parse(await readFile('public/data/events.json','utf8'));
 const registry=JSON.parse(await readFile('public/data/sources.json','utf8'));
 if(process.env.GITHUB_ACTIONS==='true'){
   const old=await fetch('https://exeterwasabi.github.io/taiwan-market-walk/public/data/events.json',{signal:AbortSignal.timeout(30000),cache:'no-store'});
   if(!old.ok)throw new Error('無法取得已發布快照，停止以免遺失舊活動');
   previous=await old.json();
   const remote=await fetch('https://exeterwasabi.github.io/taiwan-market-walk/public/data/sources.json',{signal:AbortSignal.timeout(30000),cache:'no-store'});
   // 404 is allowed only for the first rollout of the fixed-source registry.
   if(remote.ok){const saved=await remote.json();if(!Array.isArray(saved.sources))throw new Error('已發布來源清單格式錯誤');registry.sources=[...new Map([...saved.sources,...registry.sources].map(s=>[s.url,s])).values()];}
   else if(remote.status!==404)throw new Error('無法取得已發布固定來源清單');
 }
 if(!Array.isArray(previous.events))throw new Error('舊快照格式錯誤');
 const events=mergeEvents(previous.events,incoming);
 registry.sources=mergeSources(registry.sources,[...previous.events,...incoming]);
 await writeFile('public/data/sources.json',JSON.stringify(registry,null,2));
 const data={fetchedAt:new Date().toISOString(),sourceUpdated:feed.UpdateTime,reviewedAt:reviewed.checkedAt,source:'觀光署開放資料＋農會／主辦公告人工場次',sourceUrl:'https://data.gov.tw/dataset/7778',license:'政府資料開放授權條款第1版',rejected,events};
 await writeFile('public/data/events.json.tmp',JSON.stringify(data,null,2));await rename('public/data/events.json.tmp','public/data/events.json');
 console.log(`匯入 ${events.length} 筆市集相關活動；排除 ${rejected} 筆異常日期或缺漏資料。`);
} catch(error){console.error('更新失敗，既有快照保持不變：',error.message);process.exitCode=1;}


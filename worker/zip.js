// Read one known JSON entry via the ZIP central directory (supports data descriptors).
export async function readEventZip(buffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer);
 for(let at=Math.max(0,bytes.length-65557);at+22<=bytes.length;at++){
  if(view.getUint32(at,true)!==0x06054b50)continue;
  let cursor=view.getUint32(at+16,true);
  const count=view.getUint16(at+10,true);
  for(let i=0;i<count;i++){
   if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw Error('Invalid ZIP directory');
   const size=view.getUint32(cursor+20,true),expanded=view.getUint32(cursor+24,true);
   const nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
   const name=new TextDecoder().decode(bytes.slice(cursor+46,cursor+46+nameLength));
   if(name==='EventList.json'){
    if(expanded>20_000_000)throw Error('Feed too large');
    const local=view.getUint32(cursor+42,true),method=view.getUint16(cursor+10,true);
    if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw Error('Invalid ZIP entry');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    if(start+size>bytes.length)throw Error('Truncated ZIP');
    const compressed=bytes.slice(start,start+size);
    const result=method===0?compressed:method===8?new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()):null;
    if(!result||result.length!==expanded)throw Error('Unsupported or damaged ZIP');
    return JSON.parse(new TextDecoder().decode(result).replace(/^\uFEFF/,''));
   }
   cursor+=46+nameLength+extra+comment;
  }
 }
 throw Error('EventList.json missing');
}

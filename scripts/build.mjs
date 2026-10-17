import {mkdir,copyFile,cp,writeFile,readFile,readdir} from 'node:fs/promises';
const buildId=Date.now();
await mkdir('dist',{recursive:true});
for(const file of ['index.html','manifest.webmanifest','sw.js'])await copyFile(file,`dist/${file}`);
for(const folder of ['src','public'])await cp(folder,`dist/${folder}`,{recursive:true});
const index=await readFile('dist/index.html','utf8');
await writeFile('dist/index.html',index.replace('./src/app.js',`./src/app.js?v=${buildId}`));
for(const name of await readdir('dist/src'))if(name.endsWith('.js')){
 const file=`dist/src/${name}`,code=await readFile(file,'utf8');
 await writeFile(file,code.replace(/(from\s+['"]\.\/[^'"?]+\.js)(['"])/g,`$1?v=${buildId}$2`));
}
await writeFile('dist/.nojekyll','');
const metadata={automaticUpdates:process.env.GITHUB_ACTIONS==='true',scheduleTaipei:'每日約 06:20',builtAt:new Date().toISOString()};
await writeFile('dist/public/deployment.json',JSON.stringify(metadata));
const sw=await readFile('sw.js','utf8');
await writeFile('dist/sw.js',sw.replace('market-walk-v1',`market-walk-${buildId}`).replace(/(\.\/src\/[^']+\.js)'/g,`$1?v=${buildId}'`));
console.log('網站已打包至 dist；僅包含公開網站檔案。');

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const CHROME = ['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>existsSync(p));
const b = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const pg = await b.newPage(); await pg.setViewport({width:1000,height:620});
pg.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await pg.goto('http://localhost:5173/?quality=fast',{waitUntil:'domcontentloaded'});
await pg.waitForFunction('window.__cutaway&&window.__cutaway.ready',{timeout:180000,polling:400});
await pg.evaluate(()=>{
  const a = window.__cutaway.app;
  a.setPhoto(true); a.setDolly(false); a.setDayAuto(false); a.setTime(13);
  a.applyPreset('platform', true);
  /* park a local at the platform with doors open */
  const t = a.trains.local[0];
  t.state = 'dwell'; t.x = t.target; t.v = 0; t.dwell = 999;
  a.trains.doorOpen = 1;
  /* hide the world so only the stock is visible */
  a.world.visible = false; a.skin.mesh.visible = false; a.earth.mesh.visible = false;
  for (const bd of a.backdrops) bd.mesh.visible = false;
  a.sky.dome.visible = false;
});
await new Promise(r=>setTimeout(r,9000));
console.log(await pg.evaluate(()=>{
  const a=window.__cutaway.app;
  const rows=[];
  a.scene.traverse(o=>{ if(o.name && /train|figure|lift|car/i.test(o.name) && o.isMesh) rows.push(`${o.name} count=${o.count ?? 1} vis=${o.visible} pos=${o.position.toArray().map(v=>v.toFixed(1))}`); });
  return rows.join('\n') + '\ncam ' + a.camera.position.toArray().map(v=>v.toFixed(1)) + ' target ' + a.rig.target.toArray().map(v=>v.toFixed(1));
}));
await pg.screenshot({path:'shots/T-trains.jpg', type:'jpeg', quality:0.9});
await b.close();

import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const CHROME = ['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>existsSync(p));
const b = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const pg = await b.newPage(); await pg.setViewport({width:800,height:500});
pg.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await pg.goto(`http://localhost:5173/?quality=fast`,{waitUntil:'domcontentloaded'});
await pg.waitForFunction('window.__cutaway&&window.__cutaway.ready',{timeout:180000,polling:400});
await pg.evaluate(()=>{window.__cutaway.setPhoto(true);window.__cutaway.setDolly(false);window.__cutaway.setDayAuto(false);});
for (const w of [3000, 16000, 32000]) {
  await new Promise(r=>setTimeout(r, w===3000?3000:13000));
  console.log(JSON.stringify(await pg.evaluate(()=>{
    const a=window.__cutaway.app;
    return {t:a.dial.hour.toFixed(1), label:a.trains.label, local0:{x:+a.trains.local[0].x.toFixed(1),v:+a.trains.local[0].v.toFixed(2),st:a.trains.local[0].state}, doorOpen:+a.trains.doorOpen.toFixed(2),
      express:+a.trains.express.x.toFixed(1), people:a.life.count(), bodies:a.life.crowd.mesh.count, traffic:a.traffic.count(), cars:a.trains.body.count, doors:a.trains.door.count, cut:a.cut};
  })));
}
await b.close();

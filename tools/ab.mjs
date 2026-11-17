import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
const CHROME = ['/usr/bin/google-chrome','/usr/bin/chromium'].find(p=>existsSync(p));
const b = await puppeteer.launch({executablePath:CHROME,headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const pg = await b.newPage(); await pg.setViewport({width:900,height:520});
pg.on('pageerror',e=>console.log('PAGEERROR:',e.message));
await pg.goto('http://localhost:5173/?quality=fast',{waitUntil:'domcontentloaded'});
await pg.waitForFunction('window.__cutaway&&window.__cutaway.ready',{timeout:180000,polling:400});
await pg.evaluate(()=>{const a=window.__cutaway.app;a.setPhoto(true);a.setDolly(false);a.setDayAuto(false);a.setTime(13);a.applyPreset('hero',true);
  a.earth.uniforms.uDim.value = 3.0; for (const bd of a.backdrops) bd.mesh.visible=false;});
await new Promise(r=>setTimeout(r,6000));
await pg.screenshot({path:'shots/AB-earthonly.jpg',type:'jpeg',quality:0.9});
await pg.evaluate(()=>{const a=window.__cutaway.app;a.earth.mesh.visible=false;a.earth.uniforms.uDim.value=1; for (const bd of a.backdrops) bd.mesh.visible=true;});
await new Promise(r=>setTimeout(r,4000));
await pg.screenshot({path:'shots/AB-backdrops.jpg',type:'jpeg',quality:0.9});
console.log(await pg.evaluate(()=>{
  const a=window.__cutaway.app; const r=a.renderer; const gl=r.getContext();
  const px=new Uint8Array(4*6);
  // sample a vertical strip through the underground
  const w=r.domElement.width, h=r.domElement.height;
  const out=[];
  for (const fy of [0.5,0.7,0.8,0.86,0.92,0.97]) {
    gl.readPixels(Math.floor(w*0.5), Math.floor(h*(1-fy)), 1,1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    out.push(`y${fy}: rgb ${px[0]},${px[1]},${px[2]}`);
  }
  return out.join(' | ');
}));
await b.close();

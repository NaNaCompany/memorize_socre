const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const verovio=require('../vendor/verovio/verovio-toolkit-wasm.js');
const ready=new Promise((resolve,reject)=>{
  if(verovio.module.calledRun){resolve();return;}
  const timer=setTimeout(()=>reject(Error('Verovio initialization timed out')),25000);
  const previous=verovio.module.onRuntimeInitialized;
  verovio.module.onRuntimeInitialized=()=>{clearTimeout(timer);if(previous)previous();resolve();};
});
test('both sanitized sample scores render with the bundled Verovio engine',async()=>{
  await ready;
  verovio.enableLog(verovio.LOG_OFF);
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../samples/manifest.json'),'utf8'));
  for(const sample of manifest.samples){
    const xml=fs.readFileSync(path.join(__dirname,'..',sample.file),'utf8');
    assert.ok(!/<identification\b/.test(xml));
    const toolkit=new verovio.toolkit();
    toolkit.setOptions({inputFrom:'musicxml',footer:'none',header:'none',svgViewBox:true,pageWidth:2100,pageHeight:2970,scale:40});
    assert.ok(toolkit.loadData(xml),sample.id);
    const pages=toolkit.getPageCount();assert.ok(pages>0,sample.id);
    for(const page of new Set([1,pages])){
      const svg=toolkit.renderToSVG(page);assert.ok(svg.includes('<svg'),sample.id);assert.ok(svg.includes('class="note"'),sample.id);
    }
    console.log(JSON.stringify({sample:sample.id,measures:sample.measures,pages,first_and_last_page_rendered:true}));
    toolkit.destroy();
  }
});

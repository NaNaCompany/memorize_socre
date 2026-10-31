import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../js/ui.js',import.meta.url),'utf8');
const h=ui.slice(ui.indexOf('export function h('),ui.indexOf('export const shuffle')).replace('export function','function');
class Element {
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.events={};}
 setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,v){this.events[k]=v;} append(...v){this.children.push(...v);} replaceChildren(...v){this.children=[...v];}
}
const walk=(node,tag)=>node instanceof Element?[...(node.tag===tag?[node]:[]),...node.children.flatMap(x=>walk(x,tag))]:[];
const text=node=>node instanceof Element?node.children.map(text).join(''):String(node);
function home(sample=true,recent=null){
 const events=[];
 const library=sample?[{id:'builtin-score',builtin:true}]:[];
 if(recent)library.push(recent);
 const context={document:{createElement:tag=>new Element(tag)},state:{library},prefs:{piece:recent?.id},fileInput:{click:()=>events.push('upload')},openPiece:id=>events.push(id),reportList:()=>null};
 const hero=app.slice(app.indexOf('function recentScore()'),app.indexOf('function viewLibrary()'));
 const demos=app.slice(app.indexOf('const DEMOS'),app.indexOf('function reportList()'));
 vm.runInNewContext(h+'\n'+demos+'\n'+hero+'\nthis.result={hero:hero(),showcase:showcase()};',context);
 return {...context.result,events};
}
test('main actions preserve upload and built-in sample entry points',()=>{
 const result=home();const buttons=walk(result.hero,'button');
 buttons.find(x=>text(x)==='악보 불러오기').events.click();buttons.find(x=>text(x)==='샘플로 연습').events.click();
 assert.deepEqual(result.events,['upload','builtin-score']);assert.equal(text(walk(result.hero,'h1')[0]),'악보 암기');
});
test('a cached score is a resume banner and is opened only by an explicit click',()=>{
 const result=home(true,{id:'saved-score',title:'Saved score'});
 assert.deepEqual(result.events,[]);
 const banner=walk(result.hero,'aside');assert.equal(banner.length,1);assert.ok(text(banner[0]).includes('최근 악보'));
 walk(banner[0],'button')[0].events.click();assert.deepEqual(result.events,['saved-score']);
});
test('fresh visits show the landing page without a resume banner',()=>{
 assert.equal(walk(home().hero,'aside').length,0);
});
test('every startup reaches the landing page even with saved scores and stale exercise hashes',async()=>{
 const startup=app.slice(app.lastIndexOf('(async function start()'));
 for(const hash of ['','#practice','#view','#mix','#library']){
  const calls=[];const prefs={piece:'saved-score'};const library=[{id:'saved-score',title:'Saved score'}];
  const location={hash};
  const context={location,prefs,state:{library},loadLibrary:()=>library,SAMPLES:[],refreshLibrary:async()=>calls.push('samples-ready'),go:route=>{calls.push(route);location.hash='#'+route;},viewLibrary:()=>calls.push('refresh-visible-home'),openPiece:()=>{throw Error('Unexpected automatic score load');}};
  await vm.runInNewContext(startup,context);assert.deepEqual(calls,['library','samples-ready','refresh-visible-home']);assert.equal(prefs.piece,'saved-score');assert.equal(library.length,1);
 }
});
test('the home renders before sample requests settle and late responses cannot replace a selected exercise',async()=>{
 const startup=app.slice(app.lastIndexOf('(async function start()'));
 let release;const pending=new Promise(resolve=>release=resolve);const calls=[];const location={hash:'#practice'};
 const context={location,state:{library:[]},loadLibrary:()=>[],SAMPLES:[],go:route=>{calls.push(route);location.hash='#'+route;},refreshLibrary:()=>pending,viewLibrary:()=>calls.push('unexpected-home-refresh')};
 const started=vm.runInNewContext(startup,context);assert.deepEqual(calls,['library']);location.hash='#view';release();await started;assert.deepEqual(calls,['library']);
});
test('the library keeps its hero and explicit score choices when uploaded scores exist',()=>{
 const context={document:{createElement:tag=>new Element(tag)},main:new Element('main'),state:{library:[{id:'saved',title:'Saved score',sample:false}]},hero:()=>new Element('hero-proof'),showcase:()=>new Element('features-proof'),masteryOf:()=>null,openPiece:()=>{},renamePiece:()=>{},removePiece:()=>{}};
 const library=app.slice(app.indexOf('function viewLibrary()'),app.indexOf('function renamePiece('));
 vm.runInNewContext(h+'\n'+library+'\nviewLibrary();',context);
 assert.equal(walk(context.main,'hero-proof').length,1);assert.ok(text(context.main).includes('내 악보'));assert.ok(text(context.main).includes('Saved score'));
});
test('missing sample never exposes a broken sample action',()=>{
 assert.equal(walk(home(false).hero,'button').length,1);
});
test('practice groups stay compact while extra examples remain accessible',()=>{
 const result=home();assert.equal(walk(result.showcase,'article').length,3);assert.equal(walk(result.showcase,'details').length,1);
 assert.equal(walk(result.showcase,'details')[0].attrs.open,undefined);
 for(const image of [...walk(result.hero,'img'),...walk(result.showcase,'img')])assert.ok(image.attrs['data-still-src'].endsWith('-still.png'));
});
function motion(reduced=false,saved=null){
 const handlers={};const classes=new Map();const values=[];const image={dataset:{motionSrc:'demo.gif',stillSrc:'demo.png'},src:'demo.gif',getAttribute(){return this.src;},setAttribute(k,v){this.src=v;}};
 const control={textContent:'',setAttribute(k,v){this[k]=v;},addEventListener(k,fn){handlers.click=fn;}};
 const context={matchMedia:()=>({matches:reduced,addEventListener(k,fn){handlers.media=fn;}}),localStorage:{getItem:()=>saved,setItem:(k,v)=>values.push(v)},document:{getElementById:()=>control,body:{classList:{toggle:(k,v)=>classes.set(k,v)}},querySelectorAll:()=>[image]},MutationObserver:class{observe(){}}};
 vm.runInNewContext(fs.readFileSync(new URL('../js/motion.js',import.meta.url),'utf8'),context);
 return {handlers,classes,values,image,control};
}
test('reduced motion selects a still image; manual resume restores animation',()=>{
 const s=motion(true);assert.equal(s.image.src,'demo.png');assert.equal(s.classes.get('motion-paused'),true);
 s.handlers.click();assert.equal(s.image.src,'demo.gif');assert.equal(s.classes.get('motion-enabled'),true);assert.deepEqual(s.values,['false']);
});
test('stored pause choice takes precedence over system motion preference',()=>{
 const s=motion(false,'true');assert.equal(s.image.src,'demo.png');assert.equal(s.control['aria-pressed'],'true');
});

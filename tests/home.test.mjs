import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../js/ui.js',import.meta.url),'utf8');
const h=ui.slice(ui.indexOf('export function h('),ui.indexOf('export const shuffle')).replace('export function','function');
class Element {
 constructor(tag){this.tag=tag;this.attrs={};this.children=[];this.events={};}
 setAttribute(k,v){this.attrs[k]=v;} addEventListener(k,v){this.events[k]=v;} append(v){this.children.push(v);}
}
const walk=(node,tag)=>node instanceof Element?[...(node.tag===tag?[node]:[]),...node.children.flatMap(x=>walk(x,tag))]:[];
const text=node=>node instanceof Element?node.children.map(text).join(''):String(node);
function home(sample=true){
 const events=[];
 const context={document:{createElement:tag=>new Element(tag)},state:{library:sample?[{id:'builtin-score',builtin:true}]:[]},fileInput:{click:()=>events.push('upload')},openPiece:id=>events.push(id),reportList:()=>null};
 const hero=app.slice(app.indexOf('function hero()'),app.indexOf('function viewLibrary()'));
 const demos=app.slice(app.indexOf('const DEMOS'),app.indexOf('function reportList()'));
 vm.runInNewContext(h+'\n'+demos+'\n'+hero+'\nthis.result={hero:hero(),showcase:showcase()};',context);
 return {...context.result,events};
}
test('main actions preserve upload and built-in sample entry points',()=>{
 const result=home();const buttons=walk(result.hero,'button');
 buttons.find(x=>text(x)==='악보 불러오기').events.click();buttons.find(x=>text(x)==='샘플로 연습').events.click();
 assert.deepEqual(result.events,['upload','builtin-score']);assert.equal(text(walk(result.hero,'h1')[0]),'악보 암기');
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

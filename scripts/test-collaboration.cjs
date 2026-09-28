
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const assert=require('node:assert/strict');
const memory=new Map();global.sessionStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
const {createLoader}=require(path.join(root,'scripts/ts-loader.cjs'));
const real=createLoader();const {newAppDoc}=real('src/lib/shared/doc.ts');
const results=[];
class FakeES{
 constructor(){this.events={};FakeES.last=this}
 addEventListener(name,fn){this.events[name]=fn}
 close(){}
 emit(name,data){this.events[name]?.({data:JSON.stringify(data)})}
}
global.EventSource=FakeES;global.document={addEventListener(){},removeEventListener(){},visibilityState:'visible'};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function setup(api){
 let state;const listeners=new Set();
 const useEditor={setState(patch){const old=state;state={...state,...(typeof patch==='function'?patch(state):patch)};for(const cb of listeners)cb(state,old)},subscribe(cb){listeners.add(cb);return()=>listeners.delete(cb)}};
 const mock={ed:()=>state,useEditor,bumpData(){useEditor.setState({bumps:(state.bumps||0)+1})},setCollections(cols){useEditor.setState({collections:cols})}};
 const toast=()=>{};toast.error=()=>{};
 class ApiError extends Error{}
 const load=createLoader({'./store':mock,'@/components/ui/toast':{toast},'@/lib/client/api':{api,ApiError,errorMessage:e=>e.message}});
 return{live:load('src/components/editor/live.ts'),get:()=>state,set(id,doc){state={app:{id},doc,revision:1,pageId:doc.homePageId,selection:[],peers:{},user:{id:'audit'},view:'design',bp:'desktop',saveState:'saved',gesture:0,liveDataVersion:0,collections:[]}},useEditor};
}
(async()=>{
{
let pending,firstBody;const h=setup((url,opts)=>url.endsWith('/live')?new Promise(r=>{pending=r;firstBody=opts.body}):Promise.resolve({collections:[]}));
const docA=newAppDoc(),docB=newAppDoc();h.set('app_A',docA);const closeA=h.live.startLive();
const changed={...docA,theme:{...docA.theme,colors:{...docA.theme.colors,primary:'#123456'}}};
h.useEditor.setState({doc:changed,saveState:'dirty'});const saving=h.live.syncNow(200);
await delay(2);closeA();h.set('app_B',docB);const closeB=h.live.startLive();
pending({type:'change',rev:2,clientId:firstBody.clientId,userId:'audit',changes:firstBody.changes,accepted:firstBody.changes.map(c=>c.k),adjusted:[]});
await delay(10);
results.push({name:'late save response after switching apps',currentApp:h.get().app.id,originalBColor:docB.theme.colors.primary,currentBColor:h.get().doc.theme.colors.primary,AColor:changed.theme.colors.primary,revisionB:h.get().revision});
closeB();await saving;
}
{
let schemaReads=0;const h=setup((url)=>{if(url.endsWith('/collections'))schemaReads++;return Promise.resolve({collections:[]})});
h.set('app_data',newAppDoc());const close=h.live.startLive();
FakeES.last.emit('data',{kind:'collections'});FakeES.last.emit('data',{kind:'records'});
await delay(320);results.push({name:'collection notification followed by record notification',schemaReads,recordRefreshes:h.get().bumps});close();
}
{
let submitted;const h=setup((url,opts)=>{if(url.endsWith('/live')){submitted=opts.body.changes;return Promise.resolve({type:'ack',rev:1,accepted:submitted.map(c=>c.k),adjusted:submitted.map(c=>c.k),changes:submitted.map(c=>({k:c.k,v:doc.settings}))})}return Promise.resolve({})});
const doc=newAppDoc();h.set('app_ack',doc);const close=h.live.startLive();
h.useEditor.setState({doc:{...doc,settings:{...doc.settings,extraRejectedBySanitizer:true}},saveState:'dirty'});
const saved=await h.live.syncNow(200);
results.push({name:'server adjusted no-change acknowledgement',reportedSaved:saved,clientStillHasRejectedValue:h.get().doc.settings.extraRejectedBySanitizer===true});close();
}
const [late,data,ack]=results;
assert.equal(late.currentBColor,late.originalBColor);assert.equal(late.revisionB,1);
assert.equal(data.schemaReads,1);assert.equal(data.recordRefreshes,1);
assert.equal(ack.reportedSaved,true);assert.equal(ack.clientStillHasRejectedValue,false);
for(const result of results) console.log('PASS '+result.name);
console.log('3/3 collaboration checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

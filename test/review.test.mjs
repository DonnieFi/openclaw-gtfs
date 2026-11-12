import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { mkdtemp,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Bindings from 'gtfs-realtime-bindings';
import { parseCatalog } from '../dist/catalog.js';
import { TransitService } from '../dist/service.js';
import { scheduleWork } from '../dist/workers.js';
const encode=(entities,timestamp)=>Bindings.transit_realtime.FeedMessage.encode({header:{gtfsRealtimeVersion:'2.0',timestamp},entity:entities}).finish();
const scope={agentId:'review',assertCurrent(){}};
const system={id:'fixture',name:'Fictional Transit',location:'Fictional City',status:'active',schedule:{url:'https://fixture.invalid/static',requiresAuth:false},tripUpdates:[],vehicles:[],alerts:[]};
const state=value=>({lookup:async()=>value,register:async()=>{throw new Error('Unexpected state write');}});
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('one malformed catalog endpoint does not hide valid systems',()=>{
 const csv=['id,data_type,provider,urls.direct_download,static_reference,entity_type,status',
 'good,gtfs,Good Transit,https://example.org/feed.zip,,,active',
 'broken,gtfs,Broken,not-a-url,,,active',
 'rt,gtfs_rt,Good Transit,bad-url,good,tu,active'].join(String.fromCharCode(10));
 const systems=parseCatalog(Buffer.from(csv));assert.equal(systems.length,1);assert.equal(systems[0].id,'good');assert.deepEqual(systems[0].tripUpdates,[]);
});
test('worker checks current invocation at admission',async()=>{
 await assert.rejects(scheduleWork({op:'info',database:'/definitely-not-a-feed.db'},undefined,()=>{throw new Error('revoked-before-worker');}),/revoked-before-worker/);
});
test('failed feed waits for sibling request cleanup before settling',async()=>{
 const later=deferred();const settings={...system,vehicles:[{url:'https://fixture.invalid/fail',requiresAuth:false},{url:'https://fixture.invalid/slow',requiresAuth:false}]};
 let cleaned=false,settled=false;
 const fetch=async url=>{if(url.endsWith('/fail'))throw new Error('expected-failure');try{return await later.promise;}finally{cleaned=true;}};
 const service=new TransitService(fetch,state(settings),'/unused');
 const pending=service.vehicles(undefined,2,scope).catch(e=>{settled=true;return e;});
 try{await tick();assert.equal(settled,false);}finally{later.resolve(encode([],Math.floor(Date.now()/1000)));await pending;}
 assert.equal(cleaned,true);assert.equal(settled,true);
});
test('feed health is evaluated after all downloads finish',async t=>{
 const base=1_800_000_000_000;t.mock.timers.enable({apis:['Date'],now:base});
 const later=deferred();const settings={...system,vehicles:[{url:'https://fixture.invalid/early',requiresAuth:false},{url:'https://fixture.invalid/late',requiresAuth:false}]};
 const service=new TransitService(async url=>url.endsWith('/early')?encode([],base/1000-110):await later.promise,state(settings),'/unused');
 const pending=service.vehicles(undefined,2,scope);await tick();t.mock.timers.tick(30_000);later.resolve(encode([],base/1000-110));
 const result=await pending;assert.ok(result.feeds.every(f=>f.fresh===false));assert.deepEqual(result.vehicles,[]);
});

async function withDepartures(endpoints,action){
 const root=await mkdtemp(join(tmpdir(),'hopper-review-'));const archive=await readFile(new URL('./fixtures/loop.zip',import.meta.url));
 const settings={...system,tripUpdates:Object.keys(endpoints).map(url=>({url,requiresAuth:false}))};
 const service=new TransitService(async url=>url===system.schedule.url?archive:endpoints[url],state(settings),root);
 try{await action(service);}finally{await rm(root,{recursive:true,force:true});}
}
function update(timestamp,relationship=0){return {id:'T1',tripUpdate:{timestamp,trip:{tripId:'T1',routeId:'R1',scheduleRelationship:relationship},stopTimeUpdate:[
 {stopId:'S1',stopSequence:1,departure:{time:timestamp+300}},
 {stopId:'S1',stopSequence:3,departure:{time:timestamp+900}},
 {stopId:'S1',stopSequence:5,departure:{time:timestamp+1200}},
]}};}
test('looping trip keeps repeated stop visits and applies each boarding rule',async()=>{
 const now=Math.floor(Date.now()/1000);
 await withDepartures({'https://fixture.invalid/rt':encode([update(now)],now)},async service=>{
  const result=await service.departures('S1',5,undefined,scope);
  assert.deepEqual(result.departures.map(d=>d.departureTime),[new Date((now+900)*1000).toISOString(),new Date((now+1200)*1000).toISOString()]);
 });
});
test('newer cancellation suppresses older prediction regardless of feed order',async()=>{
 const now=Math.floor(Date.now()/1000);const a=encode([update(now-10)],now);const b=encode([update(now,3)],now);
 for(const endpoints of [{'https://fixture.invalid/a':a,'https://fixture.invalid/b':b},{'https://fixture.invalid/b':b,'https://fixture.invalid/a':a}]){
  await withDepartures(endpoints,async service=>assert.deepEqual((await service.departures('S1',5,undefined,scope)).departures,[]));
 }
});

test('an omitted start time and one explicit start time identify the same trip instance',async()=>{
 const now=Math.floor(Date.now()/1000);const older=update(now-10);older.tripUpdate.trip.startDate='20261111';
 const newer=update(now);newer.tripUpdate.trip.startDate='20261111';newer.tripUpdate.trip.startTime='08:00:00';
 await withDepartures({'https://fixture.invalid/rt':encode([older,newer],now)},async service=>{
  const result=await service.departures('S1',5,undefined,scope);
  assert.deepEqual(result.departures.map(d=>d.departureTime),[new Date((now+900)*1000).toISOString(),new Date((now+1200)*1000).toISOString()]);
 });
});

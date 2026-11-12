import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Bindings from 'gtfs-realtime-bindings';
import { parseCatalog, searchCatalog } from '../dist/catalog.js';
import { decodeFeed, departurePredictions, freshness, vehiclePositions } from '../dist/realtime.js';
import { TransitService, HALIFAX } from '../dist/service.js';
import { checkScheduleArchive } from '../dist/schedule.js';

const now = 1_800_000_000_000;
function feed(entities, timestamp = now/1000) {
  return decodeFeed(Bindings.transit_realtime.FeedMessage.encode({header:{gtfsRealtimeVersion:'2.0',timestamp},entity:entities}).finish());
}
function prediction(id, relationship=0, stopRelationship=0, time=now/1000+300) {
  return {id,tripUpdate:{trip:{tripId:id,routeId:'R1',scheduleRelationship:relationship},
    stopTimeUpdate:[{stopId:'S1',stopSequence:1,scheduleRelationship:stopRelationship,departure:{time}}]}};
}
const rows = [
  'id,data_type,provider,location.municipality,location.country_code,urls.direct_download,urls.authentication_type,static_reference,entity_type,status',
  'mdb-1,gtfs,Example Transit,Example City,CA,https://example.org/schedule.zip,0,,,active',
  'mdb-2,gtfs_rt,Example Transit,,,https://example.org/trips.pb,0,mdb-1,tu,active',
  'mdb-3,gtfs_rt,Example Transit,,,https://example.org/vehicles.pb,1,mdb-1,vp,active',
  'mdb-4,gtfs_rt,Example Transit,,,https://example.org/wrong.pb,0,mdb-999,tu,active',
  'mdb-5,gtfs,Old Transit,Example City,CA,https://example.org/old.zip,0,,,deprecated',
].join(String.fromCharCode(10));
test('catalog joins realtime by static reference, exposes auth, and excludes deprecated feeds',()=>{
  const systems=parseCatalog(Buffer.from(rows));
  assert.equal(systems.length,1);assert.equal(systems[0].tripUpdates.length,1);
  assert.equal(systems[0].vehicles[0].requiresAuth,true);
  assert.deepEqual(searchCatalog(systems,'EXAMPLE city').map(s=>s.id),['mdb-1']);
  assert.deepEqual(searchCatalog(systems,'not here'),[]);
});
test('realtime filters canceled trips, skipped/no-data stops, past predictions, and stale feeds',()=>{
  const data=feed([prediction('ok'),prediction('canceled',3),prediction('skipped',0,1),prediction('unknown',0,2),prediction('past',0,0,now/1000-1)]);
  assert.deepEqual(departurePredictions([data],'S1',now).map(p=>p.tripId),['ok']);
  assert.equal(departurePredictions([data],'wrong',now).length,0);
  assert.equal(freshness(feed([],now/1000-121),now).fresh,false);
  assert.deepEqual(departurePredictions([feed([prediction('old')],now/1000-121)],'S1',now),[]);
});
test('prediction timestamps remain absolute across a day boundary',()=>{
  const midnight=Date.parse('2026-11-12T04:00:00Z');
  const data=feed([prediction('after-midnight',0,0,midnight/1000+60)],midnight/1000-30);
  const [p]=departurePredictions([data],'S1',midnight-30_000);
  assert.equal(new Date(p.departureMs).toISOString(),'2026-11-12T04:01:00.000Z');
});
test('vehicle reads preserve route filtering and m/s conversion',()=>{
  const data=feed([{id:'v1',vehicle:{trip:{routeId:'R1'},vehicle:{id:'42'},position:{latitude:44.6,longitude:-63.5,speed:10},timestamp:now/1000}}]);
  assert.equal(vehiclePositions(data,now,'R1')[0].speedKmh,36);
  assert.deepEqual(vehiclePositions(data,now,'R2'),[]);
});
test('selection reads are agent-scoped and failed setup keeps previous selection',async()=>{
  const root=await mkdtemp(join(tmpdir(),'hopper-test-'));const values=new Map([['agent:alice',HALIFAX],['agent:bob',{...HALIFAX,id:'other'}]]);
  const store={lookup:async key=>values.get(key),register:async(key,value,{assertCurrent})=>{assertCurrent();values.set(key,value);}};
  const service=new TransitService(async()=>{throw new Error('feed offline');},store,root);
  const scope=agentId=>({agentId,assertCurrent(){}});
  try {
    assert.equal((await service.current(scope('alice'))).system.id,'mdb-734');
    assert.equal((await service.current(scope('bob'))).system.id,'other');
    await assert.rejects(service.use('mdb-734',scope('bob')),/feed offline/);
    assert.equal(values.get('agent:bob').id,'other');
    await assert.rejects(service.current({agentId:'alice',assertCurrent(){throw new Error('revoked');}}),/revoked/);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('archive rejects invalid bytes and path traversal',async()=>{
  await assert.rejects(checkScheduleArchive(Buffer.from('not a zip')));
  await assert.rejects(checkScheduleArchive(await readFile(new URL('./fixtures/traversal.zip',import.meta.url))),/invalid relative path/);
});

test('optional wire fields stay unknown and differential feeds are refused',()=>{
 const data=feed([{id:'arrival-only',tripUpdate:{trip:{tripId:'T'},stopTimeUpdate:[{stopId:'S1',arrival:{time:now/1000+300},departure:{delay:0}}]}},{id:'position-only',vehicle:{position:{latitude:44.6,longitude:-63.5}}}]);
 const [p]=departurePredictions([data],'S1',now);assert.equal(p.stopSequence,null);assert.equal(p.departureMs,now+300000);
 const [v]=vehiclePositions(data,now);assert.equal(v.bearing,null);assert.equal(v.speedKmh,null);
 const differential=Bindings.transit_realtime.FeedMessage.encode({header:{gtfsRealtimeVersion:'2.0',incrementality:1,timestamp:now/1000},entity:[]}).finish();
 assert.throws(()=>decodeFeed(differential),/Differential realtime/);
});

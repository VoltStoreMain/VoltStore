'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const deal=require('../voltdeal-core.js');
const item={id:'demo-phone-1'};
const terms={method:'meetup',window:'weekend'};
const start=()=>deal.create(item,terms,1000);
const accept=()=>deal.advance(start(),'seller_accept',null,2000);
const inspect=(result='ok')=>deal.advance(accept(),'buyer_inspect',{personallyChecked:true,result},3000);
test('request: local deal initially requested, with no payment identifiers',()=>{
 const x=start();
 assert.equal(x.status,'requested');assert.equal(x.itemId,item.id);
 assert.equal(x.method,'meetup');assert.equal(x.window,'weekend');assert.equal(x.history.length,1);
 assert.ok(!('paid' in x));assert.ok(!('paymentId' in x));assert.ok(!('sellerId' in x));
});
test('request: block unknown items and corrupt terms',()=>{
 assert.throws(()=>deal.create({id:'foreign-1'},terms),/Неизвестный/);
 assert.throws(()=>deal.create(item,{method:'escrow',window:'weekend'}),/допустимый/);
 assert.throws(()=>deal.create(item,{method:'meetup',window:'yesterday'}),/допустимый/);
});
test('buyer cannot accept on behalf of seller and cannot skip approval',()=>{
 const x=start();assert.deepEqual(deal.actions(x,'buyer'),['buyer_cancel']);
 assert.throws(()=>deal.advance(x,'buyer_inspect',{personallyChecked:true,result:'ok'}),/недоступно/);
 assert.throws(()=>deal.advance(x,'seller_confirm',{handoverConfirmed:true}),/недоступно/);
});
test('seller accepts or declines from requested',()=>{
 assert.equal(deal.advance(start(),'seller_accept').status,'accepted');
 assert.equal(deal.advance(start(),'seller_decline').status,'declined');
 assert.deepEqual(deal.actions(deal.advance(start(),'seller_decline'),'seller'),[]);
});
test('buyer cancels requested, accepted, inspected',()=>{
 assert.equal(deal.advance(start(),'buyer_cancel').status,'cancelled');
 assert.equal(deal.advance(accept(),'buyer_cancel').status,'cancelled');
 assert.equal(deal.advance(inspect(),'buyer_cancel').status,'cancelled');
});
test('seller may cancel after acceptance',()=>{
 assert.equal(deal.advance(accept(),'seller_cancel').status,'cancelled');
 assert.throws(()=>deal.advance(start(),'seller_cancel'),/недоступно/);
});
test('buyer cannot assert inspection without physicallyChecked attestation',()=>{
 assert.throws(()=>deal.advance(accept(),'buyer_inspect',{result:'ok'}),/лично проверить/);
 assert.throws(()=>deal.advance(accept(),'buyer_inspect',{personallyChecked:true,result:'unknown'}),/лично проверить/);
});
test('personal inspection may report actual defects',()=>{
 const x=inspect('issue');
 assert.equal(x.status,'inspected');assert.equal(x.inspection.result,'issue');
 assert.equal(x.inspection.confirmedByBuyer,true);
});
test('buyer cannot confirm receiving before inspecting',()=>{
 assert.throws(()=>deal.advance(accept(),'buyer_confirm',{handoverConfirmed:true}),/недоступно/);
});
test('buyer confirmation explicitly acknowledges actual handover',()=>{
 assert.throws(()=>deal.advance(inspect(),'buyer_confirm'),/передачи/);
 assert.throws(()=>deal.advance(inspect(),'buyer_confirm',{handoverConfirmed:false}),/передачи/);
 assert.equal(deal.advance(inspect(),'buyer_confirm',{handoverConfirmed:true}).status,'buyer_confirmed');
});
test('defects require acknowledged consequences before handover',()=>{
 const issue=inspect('issue');
 assert.throws(()=>deal.advance(issue,'buyer_confirm',{handoverConfirmed:true}),/дефектах/);
 const done=deal.advance(issue,'buyer_confirm',{handoverConfirmed:true,acceptRisk:true});
 assert.equal(done.status,'buyer_confirmed');
});
test('seller cannot complete alone or without handover attestation',()=>{
 const x=deal.advance(inspect(),'buyer_confirm',{handoverConfirmed:true},4000);
 assert.throws(()=>deal.advance(x,'seller_confirm',{}),/Продавец должен/);
 assert.equal(deal.advance(x,'seller_confirm',{handoverConfirmed:true},5000).status,'completed');
});
test('completed deal has no remaining actions and no monetary proof',()=>{
 const x=deal.advance(deal.advance(inspect(),'buyer_confirm',{handoverConfirmed:true}),'seller_confirm',{handoverConfirmed:true});
 assert.equal(x.history.length,5);
 assert.deepEqual(deal.actions(x,'buyer'),[]);
 assert.deepEqual(deal.actions(x,'seller'),[]);
 assert.throws(()=>deal.advance(x,'buyer_cancel'),/недоступно/);
 assert.ok(!JSON.stringify(x).includes('paymentIntent'));
});
test('history is ordered by transition and role',()=>{
 const x=deal.advance(accept(),'buyer_inspect',{personallyChecked:true,result:'ok'});
 assert.deepEqual(x.history.map(a=>a.event),['request','seller_accept','buyer_inspect']);
 assert.deepEqual(x.history.map(a=>a.role),['buyer','seller','buyer']);
});
test('cross-item cached state is rejected',()=>{
 assert.equal(deal.normalize(start(),'demo-laptop-1'),null);
 assert.ok(deal.normalize(start(),'demo-phone-1'));
});
test('stored state rejects tampered statuses and malformed history',()=>{
 assert.equal(deal.normalize({...start(),status:'paid'},item.id),null);
 assert.equal(deal.normalize({...start(),history:[]},item.id),null);
 assert.equal(deal.normalize({...start(),history:[{event:'hacked',role:'buyer',ts:1000}]},item.id),null);
});
test('clear progress for status changes',()=>{
 assert.equal(deal.progress(null),0);
 assert.equal(deal.progress(start()),1);
 assert.equal(deal.progress(accept()),2);
 assert.equal(deal.progress(inspect()),3);
 assert.equal(deal.progress(deal.advance(inspect(),'buyer_confirm',{handoverConfirmed:true})),4);
 assert.equal(deal.progress(deal.advance(start(),'seller_decline')),0);
});
test('delivery discussions are not a shipping service',()=>{
 assert.match(deal.METHODS.delivery_discussion,/договорённости/);
 assert.ok(deal.STATES.accepted.includes('(демо)'));
});

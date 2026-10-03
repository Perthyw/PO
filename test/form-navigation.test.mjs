import test from 'node:test';
import assert from 'node:assert/strict';
import {arrowDirection,navigatePOForm} from '../dist/form-navigation.js';
const input=(overrides={})=>({tagName:'INPUT',type:'text',value:'abc',selectionStart:3,selectionEnd:3,hasAttribute:()=>false,...overrides});
test('arrows move only at boundaries and preserve selection, composition and native controls',()=>{
  assert.equal(arrowDirection({key:'ArrowRight'},input()),1);
  assert.equal(arrowDirection({key:'ArrowLeft'},input({selectionStart:0,selectionEnd:0})),-1);
  assert.equal(arrowDirection({key:'ArrowRight'},input({selectionStart:1,selectionEnd:1})),0);
  assert.equal(arrowDirection({key:'ArrowDown'},input({selectionStart:1,selectionEnd:3})),0);
  for(const guard of ['isComposing','defaultPrevented','altKey','ctrlKey','metaKey','shiftKey']) assert.equal(arrowDirection({key:'ArrowDown',[guard]:true},input()),0);
  for(const type of ['date','radio','checkbox']) assert.equal(arrowDirection({key:'ArrowDown'},input({type})),0);
  assert.equal(arrowDirection({key:'ArrowDown'},input({hasAttribute:()=>true})),0);
  assert.equal(arrowDirection({key:'ArrowDown'},input({type:'number',selectionStart:null,selectionEnd:null})),1);
  assert.equal(arrowDirection({key:'ArrowUp'},input({tagName:'TEXTAREA',selectionStart:1,selectionEnd:1})),0);
});
test('navigation focuses next enabled field, prevents numeric increment and never submits',()=>{
  let focused=false,prevented=false;
  const first=input({type:'number',selectionStart:null,selectionEnd:null});
  const disabled=input({disabled:true});
  const next=input({focus(){focused=true;}});
  const form={querySelectorAll:()=>[first,disabled,next]};
  for(const field of [first,disabled,next]) field.closest=selector=>selector==='#po-form'?form:null;
  navigatePOForm({key:'ArrowDown',target:first,preventDefault(){prevented=true;}});
  assert.ok(focused&&prevented);
  prevented=false;
  navigatePOForm({key:'ArrowDown',target:next,preventDefault(){prevented=true;}});
  assert.equal(prevented,false);
  navigatePOForm({key:'ArrowDown',target:input({closest:()=>null}),preventDefault(){throw Error('Outside PO form');}});
});

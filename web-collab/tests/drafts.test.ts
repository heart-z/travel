import{it,expect}from'vitest';import{reactive}from'vue';import{cloneDraft}from'../shared/drafts.ts';
import{pendingMutation}from'../shared/drafts.ts';
it('copies a Vue-backed edit draft without sharing mutable state',()=>{const source=reactive({name:'公园',place:{latitude:30}});const copy=cloneDraft(source);copy.place.latitude=31;expect(source.place.latitude).toBe(30);expect(copy.name).toBe('公园')});
it('reuses operation identity after an ambiguous network failure',()=>{const store=new Map();const c={type:'writeEntity',id:'one',expectedVersion:0,data:{name:'公园'}};expect(pendingMutation(c,store).mutationId).toBe(pendingMutation(cloneDraft(c),store).mutationId);expect(pendingMutation({...c,data:{name:'新公园'}},store).mutationId).not.toBe(pendingMutation(c,store).mutationId)});

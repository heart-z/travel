import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTrip,validateTrip,updateTrip} from '../src/domain/trips';
import {extractGuideUrl,guideMatches,removeGuide,saveGuide} from '../src/domain/guides';
import {exportBackup,parseBackup} from '../src/services/backup';
import type {Guide} from '../src/domain/types';
const trip=()=>createTrip({title:'攻略测试',city:'阿尔山',startDate:'2026-10-01',endDate:'2026-10-07',budget:'',companion:''});
const entry:Guide={id:'g',title:' 阿尔山路线 ',content:'景区入口 换乘巴士',sourceUrl:'https://xhslink.com/a/abc',sourceText:'分享原文',dates:['2026-10-02'],itemIds:['deleted'],category:'guide'};
test('guide validation rejects malformed import data, duplicate IDs and unsafe URLs',()=>{
 for(const patch of [{title:' '},{title:'a'.repeat(121)},{content:5},{content:'x'.repeat(12001)},{sourceText:'x'.repeat(4001)},{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://a.com\\@evil.com'},{sourceUrl:'https://user:pass@example.com'},{sourceUrl:'https://x.com\n'},{dates:['2026-02-30']},{dates:['2026-10-02','2026-10-02']},{itemIds:[1]},{itemIds:['']},{category:'unknown'}])assert.throws(()=>validateTrip({...trip(),guides:[{...entry,...patch}]} as any));
 for(const guides of [null,{},[entry,entry],Array.from({length:301},(_,i)=>({...entry,id:String(i)}))])assert.throws(()=>validateTrip({...trip(),guides} as any));
});
test('extracting share links retains query tokens and ignores unsafe schemes',()=>{
 assert.equal(extractGuideUrl('旅行攻略 http://xhslink.com/a/abc，复制本条信息打开小红书'),'http://xhslink.com/a/abc');
 assert.equal(extractGuideUrl('看这里 https://www.xiaohongshu.com/explore/123?xsec_token=a-b_c&xsec_source=pc_share。'),'https://www.xiaohongshu.com/explore/123?xsec_token=a-b_c&xsec_source=pc_share');
 assert.equal(extractGuideUrl('javascript:alert(1)'),'');assert.equal(extractGuideUrl('没有链接'),'');
});
test('guide mutations are immutable and preserve stale references and backup compatibility',()=>{
 const original=trip();const next=saveGuide(original,entry);entry.itemIds.push('another');
 assert.equal(original.guides,undefined);assert.equal(next.revision,1);assert.deepEqual(next.guides![0].itemIds,['deleted']);entry.itemIds.pop();
 const shortened=updateTrip(next,{endDate:'2026-10-01'});assert.deepEqual(shortened.guides,next.guides);
 const updated=saveGuide(next,{...next.guides![0],content:'新内容'});assert.equal(updated.guides!.length,1);assert.equal(next.guides![0].content,'景区入口 换乘巴士');
 const removed=removeGuide(updated,'g');assert.equal(removed.guides!.length,0);assert.equal(updated.guides!.length,1);assert.equal(removed.revision,3);
 assert.deepEqual(parseBackup(exportBackup({version:2,trips:[shortened]})).trips[0].guides,shortened.guides);
 validateTrip(original);
});
test('search combines words and resolves moved item dates without dropping references',()=>{
 const t=trip();t.items=[{id:'deleted',date:'2026-10-03',name:'入口',duration:0,order:0,time:'',note:'',kind:'景点'}];
 assert.ok(guideMatches(entry,'阿尔山 巴士'));assert.ok(guideMatches(entry,'XHSLINK'));assert.ok(guideMatches(entry,'分享原文'));
 assert.ok(guideMatches(entry,'',{date:'2026-10-03'},t));assert.ok(guideMatches(entry,'',{date:'2026-10-02'},t));
 assert.ok(guideMatches(entry,'',{itemId:'deleted'},t));assert.equal(guideMatches(entry,'',{date:'2026-10-04'},t),false);
});

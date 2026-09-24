import test from 'node:test';
import assert from 'node:assert/strict';
import {tripTheme} from '../src/domain/trip-theme';

test('destination themes stay stable without requesting remote imagery',()=>{
 assert.equal(tripTheme('阿尔山 · 呼伦贝尔'),'forest');
 assert.equal(tripTheme('哈尔滨'),'frost');
 assert.equal(tripTheme('上海'),'urban');
 assert.equal(tripTheme('三亚'),'coast');
 assert.equal(tripTheme('贵阳'),'classic');
});

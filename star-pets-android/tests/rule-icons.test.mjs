import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ruleIconFile } from '../ui/src/rule-icons.js';

test('rule icon mapping prefers picked icon, then minus id, then keywords', () => {
  // 用户在选择器里挑的图标优先。
  assert.equal(
    ruleIconFile({ id: 'x1', name: '主动收拾书桌', points: 3, icon: 'pick-sponge.png' }),
    'pick-sponge.png',
  );
  // 减分按 id 精确匹配，哪怕名字里有误导关键词（家人→扫帚是旧 bug）。
  assert.equal(
    ruleIconFile({ id: 'rule-rude', name: '没有礼貌地回应家人', points: -2 }),
    'minus-rolling-eyes.png',
  );
  assert.equal(
    ruleIconFile({ id: 'rule-push', name: '推搡或动手伤人', points: -3 }),
    'minus-stop-sign.png',
  );
  // 加分按名称关键词。
  assert.equal(
    ruleIconFile({ id: 'c1', name: '主动整理书包', points: 3 }),
    'bag-backpack.png',
  );
  // v2 新增规则：加分关键词与减分 id 精确匹配。
  assert.equal(ruleIconFile({ id: 'rule-brush', name: '自己刷牙', points: 3 }), 'brush-toothbrush.png');
  assert.equal(ruleIconFile({ id: 'rule-dress', name: '自己穿衣服', points: 2 }), 'pick-tshirt.png');
  assert.equal(ruleIconFile({ id: 'rule-meal', name: '好好吃饭不挑食', points: 3 }), 'pick-apple.png');
  assert.equal(ruleIconFile({ id: 'rule-sport', name: '主动运动锻炼身体', points: 3 }), 'pick-shoe.png');
  assert.equal(ruleIconFile({ id: 'rule-honest', name: '诚实说出实情', points: 3 }), 'pick-halo.png');
  assert.equal(ruleIconFile({ id: 'rule-calm', name: '生气时先冷静下来', points: 3 }), 'pick-calm.png');
  assert.equal(ruleIconFile({ id: 'rule-apology', name: '做错事主动道歉', points: 3 }), 'pick-bow.png');
  assert.equal(ruleIconFile({ id: 'rule-wait', name: '耐心等待轮到自己', points: 2 }), 'pick-hourglass.png');
  assert.equal(ruleIconFile({ id: 'rule-safety', name: '主动遵守安全规则', points: 3 }), 'pick-shield.png');
  assert.equal(ruleIconFile({ id: 'rule-tantrum', name: '乱发脾气摔东西', points: -2 }), 'pick-steam-face.png');
  assert.equal(ruleIconFile({ id: 'rule-wash', name: '饭前便后不洗手', points: -1 }), 'cat-selfcare-soap.png');
  assert.equal(ruleIconFile({ id: 'rule-latebed', name: '赖床不起', points: -2 }), 'pick-alarm.png');
  assert.equal(ruleIconFile({ id: 'rule-talkback', name: '顶撞长辈大声顶嘴', points: -2 }), 'pick-angry-face.png');
  assert.equal(ruleIconFile({ id: 'rule-whine', name: '哭闹着要买东西', points: -2 }), 'pick-sad.png');
  // 新关键词不遮挡旧规则：遇到困难继续尝试仍是运动球，
  // 多次无视安全提醒仍走减分 id 表（不是安全规则的盾牌）。
  assert.equal(ruleIconFile({ id: 'rule-persist', name: '遇到困难继续尝试', points: 4 }), 'sport-ball.png');
  assert.equal(ruleIconFile({ id: 'rule-ignore', name: '多次无视安全提醒', points: -3 }), 'minus-see-no-evil.png');
  // 无匹配 → ''，调用方回退线形图标。
  assert.equal(ruleIconFile({ id: 'c2', name: '咕噜咕噜', points: 2 }), '');
  assert.equal(ruleIconFile(null), '');
});

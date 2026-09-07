import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localizeTask } from './taskLocale';

describe('taskLocale', () => {
  it('translates known robot tasks to English', () => {
    assert.equal(localizeTask('渗透率原位测试', 'en-US'), 'In-situ permeability test');
    assert.equal(localizeTask('矿化度检测', 'en-US'), 'Mineralization survey');
    assert.equal(localizeTask('管道壁厚超声检测', 'en-US'), 'Pipe wall ultrasonic thickness scan');
    assert.equal(localizeTask('主管道焊缝超声检测', 'en-US'), 'Primary pipe weld ultrasonic scan');
    assert.equal(localizeTask('换热器管束内窥检测', 'en-US'), 'Heat-exchanger tube bundle borescope inspection');
    assert.equal(localizeTask('主运输巷点云建图', 'en-US'), 'Main haulage roadway point-cloud mapping');
    assert.equal(localizeTask('封堵墙注浆点复核', 'en-US'), 'Seal-wall grouting point review');
    assert.equal(localizeTask('腐蚀减薄标记', 'en-US'), 'Corrosion thinning tagging');
    assert.equal(localizeTask('小口径管道内腔扫描', 'en-US'), 'Small-bore pipe bore scan');
    assert.equal(localizeTask('结垢厚度成像', 'en-US'), 'Fouling-thickness imaging');
    assert.equal(localizeTask('密闭空间气体积聚复核', 'en-US'), 'Confined-space gas accumulation review');
  });

  it('keeps Chinese task labels in Chinese locale', () => {
    assert.equal(localizeTask('裂缝精细探测', 'zh-CN'), '裂缝精细探测');
  });
});

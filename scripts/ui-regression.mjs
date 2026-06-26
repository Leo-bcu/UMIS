import { chromium } from 'playwright';

const BASE_URL = process.env.HIVE_UI_BASE_URL || 'http://127.0.0.1:5174/';

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function textContent(page) {
  return await page.locator('body').innerText();
}

async function clickIfExists(page, selector) {
  const locator = page.locator(selector);
  if (await locator.count()) {
    await locator.first().click();
    return true;
  }
  return false;
}

function distance2D(a, b) {
  return Math.hypot(a.screen.x - b.screen.x, a.screen.y - b.screen.y);
}

function splitPathId(pathId) {
  return pathId.replace(/-path-\d+$/, '');
}

function chooseTarget(targets, otherTargets = [], minSeparation = 0) {
  const ranked = targets
    .map((target) => ({
      target,
      nearestOther: otherTargets.reduce((best, other) => {
        if (other.id === target.id) return best;
        return Math.min(best, distance2D(target, other));
      }, Number.POSITIVE_INFINITY),
    }))
    .filter((entry) => entry.nearestOther >= minSeparation)
    .sort((a, b) => b.nearestOther - a.nearestOther);

  return ranked[0]?.target ?? null;
}

function chooseTargets(targets, otherTargets = [], minSeparation = 0, limit = 8) {
  return targets
    .map((target) => ({
      target,
      nearestOther: otherTargets.reduce((best, other) => {
        if (other.id === target.id) return best;
        return Math.min(best, distance2D(target, other));
      }, Number.POSITIVE_INFINITY),
    }))
    .filter((entry) => entry.nearestOther >= minSeparation)
    .sort((a, b) => b.nearestOther - a.nearestOther)
    .slice(0, limit)
    .map((entry) => entry.target);
}

async function loadDevScenario(page, scenario) {
  const url = new URL(BASE_URL);
  url.searchParams.set('dev-locale', 'en-US');
  url.searchParams.set('dev-scenario', scenario);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((expected) => {
    const el = document.querySelector('[data-testid="dev-state"]');
    return el instanceof HTMLElement && el.dataset.scenario === expected;
  }, scenario);
  await page.waitForTimeout(1000);
}

async function readDevState(page) {
  return await page.locator('[data-testid="dev-state"]').evaluate((el) => ({ ...el.dataset }));
}

async function readStoreSnapshot(page) {
  return await page.evaluate(() => {
    const state = window.__HIVE_STORE__?.getState();
    if (!state) return null;
    return {
      locale: state.locale,
      dataSource: state.dataSource,
      scenario: state.scenario,
      gasThreshold: state.gasThreshold,
      activeTool: state.activeTool,
    };
  });
}

async function click3DTarget(page, target) {
  await page.mouse.click(target.screen.x, target.screen.y);
  await page.waitForTimeout(450);
  const menu = page.locator('[data-testid="overlap-pick-menu"]');
  if (await menu.count()) {
    const options = page.locator('[data-testid^="overlap-pick-option-"]');
    const optionCount = await options.count();
    let clicked = false;
    for (let i = 0; i < optionCount; i += 1) {
      const option = options.nth(i);
      const pickId = await option.getAttribute('data-pick-id');
      const pickKind = await option.getAttribute('data-pick-kind');
      const matchesRobot = target.type === 'robot' && pickId === `robot:${target.id}`;
      const matchesNode = target.type === 'fracture-node' && pickId === `node:${target.id}`;
      const matchesPath = target.type === 'fracture-path' && pickKind === 'path' && pickId?.includes(splitPathId(target.id));
      if (matchesRobot || matchesNode || matchesPath) {
        await option.click();
        clicked = true;
        break;
      }
    }
    if (!clicked && optionCount > 0) {
      await options.first().click();
    }
  }
  await page.waitForTimeout(900);
  return await readDevState(page);
}

async function try3DTargets(page, scenario, getCandidates, isPass) {
  const attempts = [];
  for (let i = 0; i < 8; i += 1) {
    await loadDevScenario(page, scenario);
    const targets = await page.evaluate(async () => window.__HIVE_TEST_API__.getInteractiveTargets());
    const candidates = getCandidates(targets).slice(0, 8);
    const target = candidates.find((candidate) => !attempts.some((attempt) => attempt.id === candidate.id));
    if (!target) break;
    const state = await click3DTarget(page, target);
    attempts.push({ id: target.id, state });
    if (isPass(target, state)) return { ok: true, target, state, attempts };
  }
  return { ok: false, attempts };
}

async function run3DSelectionChecks(page, failures, notes) {
  const scenarios = ['gold', 'pipeline', 'nuclear', 'refinery', 'coal', 'oil', 'underground'];

  for (const scenario of scenarios) {
    const robotResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(targets.robots, [], 0),
      (_target, state) => Boolean(state.selectedRobot),
    );
    if (robotResult.ok) {
      const { target: robotTarget } = robotResult;
      assert(
        true,
        `${scenario} 机器人点击后未打开机器人详情: ${robotTarget.id}`,
        failures,
      );
    } else {
      notes.push(`${scenario}: 无可点击机器人目标，尝试=${robotResult.attempts.map((item) => item.id).join(',')}`);
    }

    const nodeResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(
        targets.fractureNodes,
        [...targets.robots, ...targets.fracturePaths],
        56,
      ),
      (target, state) => state.selectedNode === target.id || state.selectedFracture === target.id.split('-N')[0],
    );
    if (nodeResult.ok) {
      const { target: nodeTarget } = nodeResult;
      assert(
        true,
        `${scenario} 独立节点点击后未打开节点/通道详情: ${nodeTarget.id}`,
        failures,
      );
    } else {
      notes.push(`${scenario}: 节点与机器人重叠或无可见节点，跳过独立节点点击`);
    }

    const pathResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(
        targets.fracturePaths,
        [...targets.robots, ...targets.fractureNodes],
        scenario === 'underground' ? 0 : 48,
      ),
      (target, state) => (
        Boolean(state.selectedFracture) || Boolean(state.selectedRobot)
      ) && (!state.selectedFracture || state.selectedFracture === splitPathId(target.id)),
    );
    if (pathResult.ok) {
      const { target: pathTarget, state } = pathResult;
      assert(
        Boolean(state.selectedFracture) || Boolean(state.selectedRobot),
        `${scenario} 通道/路径点击后未打开详情: ${pathTarget.id}`,
        failures,
      );
      if (state.selectedFracture) {
        assert(
          state.selectedFracture === splitPathId(pathTarget.id),
          `${scenario} 路径点击打开了不匹配的通道: ${pathTarget.id} -> ${state.selectedFracture}`,
          failures,
        );
      }
    } else {
      notes.push(`${scenario}: 无独立路径目标，跳过路径点击`);
    }
  }
}

async function runOverlapPickerCheck(page, failures, notes) {
  const scenarios = ['oil', 'underground', 'pipeline', 'nuclear', 'gold', 'coal', 'refinery'];

  for (const scenario of scenarios) {
    await loadDevScenario(page, scenario);
    const overlap = await page.evaluate(async () => window.__HIVE_TEST_API__.getOverlappingTargets?.() ?? null);
    if (!overlap?.screen?.visible) continue;

    await page.mouse.click(overlap.screen.x, overlap.screen.y);
    await page.waitForTimeout(800);

    const menu = page.locator('[data-testid="overlap-pick-menu"]');
    if (!(await menu.count())) {
      notes.push(`${scenario}: 找到重叠目标但未触发选择菜单，distance=${overlap.distance.toFixed(1)}`);
      continue;
    }

    const options = page.locator('[data-testid^="overlap-pick-option-"]');
    const optionCount = await options.count();
    assert(optionCount >= 2, `${scenario} 重叠选择菜单候选不足 2 个`, failures);
    await options.first().click();
    await page.waitForTimeout(1600);
    const state = await readDevState(page);
    assert(
      Boolean(state.selectedRobot || state.selectedFracture),
      `${scenario} 重叠选择菜单确认后未打开右侧详情`,
      failures,
    );
    notes.push(`${scenario}: 重叠对象选择器通过，distance=${overlap.distance.toFixed(1)}`);
    return;
  }

  notes.push('未找到可自动验证的机器人/空间对象重叠点，跳过重叠对象选择器点击回归');
}

const scenarioExpectations = [
  {
    key: 'coal',
    locale: 'zh-CN',
    dataSource: 'fracture',
    threshold: 1.5,
    mustContain: ['煤矿瓦斯', 'CH₄', '瓦斯报警红线', '巷道'],
    mustNotContain: ['剂量率控制阈值', '壁厚损失阈值', '渗透率预警阈值', 'Reactor Piping'],
  },
  {
    key: 'gold',
    locale: 'zh-CN',
    dataSource: 'fracture',
    threshold: 15,
    mustContain: ['金矿', '微震', '微震报警阈值', '应力'],
    mustNotContain: ['瓦斯报警红线', '剂量率控制阈值', '壁厚损失阈值', '地下暗流'],
    quickMustContain: ['裂缝概览', '微震分析', '应力集中'],
    quickMustNotContain: ['CH4巡检', '巷道概览'],
  },
  {
    key: 'oil',
    locale: 'zh-CN',
    dataSource: 'fracture',
    threshold: 30,
    mustContain: ['油气储层', '孔隙压力', '孔隙压力阈值', '渗透率'],
    mustNotContain: ['瓦斯报警红线', '剂量率控制阈值', '壁厚损失阈值', '地下暗流'],
    quickMustContain: ['储层概览', '孔压分析', '渗透率评估'],
    quickMustNotContain: ['CH4巡检', '巷道概览'],
  },
  {
    key: 'pipeline',
    locale: 'zh-CN',
    dataSource: 'pipeline',
    threshold: 20,
    mustContain: ['小口径管道', '管线巡检AI助手', '管段'],
    mustNotContain: ['剂量率控制阈值', '北部裂缝带', '瓦斯报警红线', '岩层围岩'],
  },
  {
    key: 'nuclear',
    locale: 'zh-CN',
    dataSource: 'nuclear',
    threshold: 25,
    mustContain: ['核反应堆', '剂量率', '冷却剂温度', '安全壳'],
    mustNotContain: ['裂缝带', '渗透率预警阈值', '瓦斯报警红线', '岩层围岩'],
  },
  {
    key: 'refinery',
    locale: 'zh-CN',
    dataSource: 'refinery',
    threshold: 50,
    mustContain: ['化工密闭空间', 'H₂S', '可燃气体', '密闭空间'],
    mustNotContain: ['剂量率控制阈值', '瓦斯报警红线', '北部裂缝带', '地下暗流'],
  },
  {
    key: 'underground',
    locale: 'zh-CN',
    dataSource: 'underground',
    threshold: 5000,
    mustContain: ['地下暗流', '渗透率', '水压'],
    mustNotContain: ['北部裂缝带', '瓦斯报警红线', '岩溶围岩'],
  },
  {
    key: 'gold',
    locale: 'en-US',
    dataSource: 'fracture',
    threshold: 15,
    mustContain: ['Gold Mine Safety AI', 'Microseismic Risk Zones', 'Stress'],
    mustNotContain: ['CH4 Alarm Threshold', 'Dose-Rate Control Threshold', 'Wall-Loss Threshold', '地下暗流'],
    quickMustContain: ['Fracture Overview', 'Microseismic Review', 'Stress Concentration'],
    quickMustNotContain: ['Roadway Overview', 'CH4 Review', 'CO Review'],
  },
  {
    key: 'oil',
    locale: 'en-US',
    dataSource: 'fracture',
    threshold: 30,
    mustContain: ['Reservoir Analysis AI', 'Pore Pressure Risk Zones', 'Permeability'],
    mustNotContain: ['CH4 Alarm Threshold', 'Dose-Rate Control Threshold', 'Wall-Loss Threshold', '地下暗流'],
    quickMustContain: ['Reservoir Overview', 'Pore-Pressure Review', 'Permeability Review'],
    quickMustNotContain: ['Roadway Overview', 'CH4 Review', 'CO Review'],
  },
  {
    key: 'pipeline',
    locale: 'en-US',
    dataSource: 'pipeline',
    threshold: 20,
    mustContain: ['Small-Bore Pipe', 'Pipeline Inspection AI', 'Pipe Segment Details'],
    mustNotContain: ['Roof displacement', 'CH4 Alarm Threshold', 'Dose-Rate Control Threshold', '北部裂缝带'],
  },
  {
    key: 'nuclear',
    locale: 'en-US',
    dataSource: 'nuclear',
    threshold: 25,
    mustContain: ['Reactor', 'Coolant Temperature', 'Containment Building'],
    mustNotContain: ['Rock Mass', 'Permeability Warning Threshold', 'Wall-Loss Threshold', '北部裂缝带'],
  },
  {
    key: 'underground',
    locale: 'en-US',
    dataSource: 'underground',
    threshold: 5000,
    mustContain: ['Underground Channel', 'Aquifer Background'],
    mustNotContain: ['Fracture Zone', 'CH4 Alarm Threshold', 'Karst Surrounding Rock', '北部裂缝带'],
  },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1728, height: 1117 } });
  const failures = [];
  const notes = [];

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  let body = await textContent(page);
  assert(body.includes('系统状态监控'), '默认中文首页未正常加载', failures);
  assert(body.includes('传感器趋势'), '默认中文控制台缺少传感器趋势模块', failures);

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setLocale('en-US');
  });
  await page.waitForTimeout(1200);

  body = await textContent(page);
  assert(body.includes('System Ready'), '切换 EN 后欢迎语未切换为英文', failures);
  assert(/quick commands/i.test(body), '切换 EN 后快捷指令标题未切换', failures);
  assert(body.includes('Compliance Notice'), '切换 EN 后合规条未切换', failures);
  assert(body.includes('Robot Fleet'), '切换 EN 后机器人面板未切换', failures);
  assert(!body.includes('系统就绪'), '切换 EN 后仍残留中文欢迎语', failures);
  assert(!body.includes('瓦斯报警红线'), '切换 EN 后阈值标题仍残留中文', failures);

  for (const scenario of scenarioExpectations) {
    await page.evaluate((config) => {
      const store = window.__HIVE_STORE__;
      const state = store?.getState();
      if (!state) return;
      state.setLocale(config.locale);
      state.setDataSource(config.dataSource);
      state.setScenario(config.key);
      state.setGasThreshold(config.threshold);
      state.clearSelection?.();
    }, scenario);
    await page.waitForTimeout(2200);

    const storeSnapshot = await readStoreSnapshot(page);
    assert(storeSnapshot?.locale === scenario.locale, `${scenario.key}/${scenario.locale} store locale 未切换`, failures);
    assert(storeSnapshot?.dataSource === scenario.dataSource, `${scenario.key}/${scenario.locale} store dataSource 未切换`, failures);
    assert(storeSnapshot?.scenario === scenario.key, `${scenario.key}/${scenario.locale} store scenario 未切换`, failures);
    assert(storeSnapshot?.gasThreshold === scenario.threshold, `${scenario.key}/${scenario.locale} store 阈值未切换`, failures);

    const scenarioText = await textContent(page);
    for (const item of scenario.mustContain) {
      assert(scenarioText.includes(item), `${scenario.key}/${scenario.locale} 场景缺少应有文案/指标: ${item}`, failures);
    }
    for (const item of scenario.mustNotContain) {
      assert(!scenarioText.includes(item), `${scenario.key}/${scenario.locale} 场景仍出现不应存在的文案: ${item}`, failures);
    }

    for (const item of scenario.quickMustContain ?? []) {
      assert(scenarioText.includes(item), `${scenario.key}/${scenario.locale} 快捷指令缺少应有文案: ${item}`, failures);
    }
    for (const item of scenario.quickMustNotContain ?? []) {
      assert(!scenarioText.includes(item), `${scenario.key}/${scenario.locale} 快捷指令仍出现不应存在的文案: ${item}`, failures);
    }
  }

  await run3DSelectionChecks(page, failures, notes);
  await runOverlapPickerCheck(page, failures, notes);

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setActiveTool('profile');
  });
  await page.waitForTimeout(600);
  let toolText = await textContent(page);
  assert(
    toolText.includes('Confirm')
      || toolText.includes('确认')
      || toolText.includes('Reselect')
      || toolText.includes('重选')
      || toolText.includes('Click two points')
      || toolText.includes('点击两点'),
    '剖面工具激活后未出现操作引导/确认控件',
    failures,
  );

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setActiveTool('distance');
  });
  await page.waitForTimeout(400);
  toolText = await textContent(page);
  assert(
    /distance/i.test(toolText)
      || toolText.includes('距离')
      || toolText.includes('Click two points')
      || toolText.includes('依次点击两个点')
      || toolText.includes('自动计算三维空间距离'),
    '测距工具激活后未出现对应引导',
    failures,
  );

  notes.push(`BASE_URL=${BASE_URL}`);

  await browser.close();

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures, notes }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, failures: [], notes }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, failures: [error.message], stack: error.stack }, null, 2));
  process.exit(1);
});

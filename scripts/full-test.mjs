// HIVE 全量浏览器测试 — 7场景/数据/交互/AI/导出/拓扑/UI/UX
// 依赖: 本地 dev server (http://127.0.0.1:5173) + playwright
import { chromium } from 'playwright';

const BASE_URL = process.env.HIVE_UI_BASE_URL || 'http://127.0.0.1:5173/';
const SCENARIOS = ['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'];

const results = {
  summary: { total: 0, passed: 0, failed: 0, warnings: 0 },
  sections: [],
  failures: [],
  warnings: [],
  notes: [],
  screenshots: [],
  consoleErrors: [],
};

function record(section, name, status, detail = '') {
  results.summary.total++;
  if (status === 'pass') results.summary.passed++;
  else if (status === 'fail') { results.summary.failed++; results.failures.push(`${section} › ${name}: ${detail}`); }
  else if (status === 'warn') { results.summary.warnings++; results.warnings.push(`${section} › ${name}: ${detail}`); }
  results.sections.push({ section, name, status, detail });
}

async function waitDevReady(page) {
  await page.waitForFunction(() => !!(window.__HIVE_STORE__ && window.__HIVE_TEST_API__), { timeout: 15000 });
}

async function getStore(page) {
  return await page.evaluate(() => {
    const s = window.__HIVE_STORE__?.getState();
    if (!s) return null;
    return {
      locale: s.locale, dataSource: s.dataSource, scenario: s.scenario,
      gasThreshold: s.gasThreshold, activeTool: s.activeTool,
      selectedRobot: s.selectedRobot?.id ?? null,
      selectedFracture: s.selectedFracture?.id ?? null,
      messagesCount: s.messages?.length ?? 0,
      findingsCount: s.findings?.length ?? 0,
      aiMarkersCount: s.aiMarkers?.length ?? 0,
      annotationsCount: s.annotations?.length ?? 0,
    };
  });
}

async function getDataset(page, dataSource, scenario) {
  return await page.evaluate(async ([ds, sc]) => {
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const d = buildSceneDataset(ds, sc);
    return {
      fractures: d.fractures.length,
      nodes: d.fractures.reduce((n, f) => n + f.nodes.length, 0),
      robots: d.robots.length,
      onlineRobots: d.robots.filter(r => r.status === 'online').length,
      meshConnected: d.robots.filter(r => r.meshConnected).length,
      alerts: d.alerts.length,
      dangerAlerts: d.alerts.filter(a => a.level === 'danger').length,
      avgConf: d.summary.scene.avgConf,
      totalNodes: d.summary.scene.totalNodes,
      avgPrimary: d.summary.scene.avgGas,
      avgTemp: d.summary.scene.avgTemp,
      overThreshold: d.summary.scene.overThreshold,
      fleetTotal: d.summary.robotFleet.total,
      fleetOnline: d.summary.robotFleet.online,
      fractureModels: [...new Set(d.fractures.map(f => f.type))],
      hasParentBranch: d.fractures.some(f => f.parentFractureId),
      sampleFracture: d.fractures[0] ? {
        id: d.fractures[0].id, name: d.fractures[0].name,
        pathLen: d.fractures[0].path.length,
        sensorKeys: Object.keys(d.fractures[0].sensorReading).length,
      } : null,
    };
  }, [dataSource, scenario]);
}

async function checkTopology(page, scenario, fracturesCount) {
  return await page.evaluate(async ([sc]) => {
    const { auditScenarioTopology } = await import('/src/domain/topologyAudit.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const dataSource = ['coal', 'gold', 'oil'].includes(sc) ? 'fracture' : sc;
    const d = buildSceneDataset(dataSource, sc);
    const issues = auditScenarioTopology(sc, d.fractures);
    const errors = issues.filter(i => i.severity === 'error');
    return { total: issues.length, errors: errors.length, codes: [...new Set(issues.map(i => i.code))] };
  }, [scenario]);
}

async function screenshot(page, name) {
  const path = `/tmp/hive-test-${name}.png`;
  await page.screenshot({ path, fullPage: false });
  results.screenshots.push({ name, path });
}

// ============ 主流程 ============
async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // 收集控制台错误
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('Download the React DevTools') && !txt.includes('favicon')) {
        results.consoleErrors.push(txt.slice(0, 200));
      }
    }
  });
  page.on('pageerror', (err) => results.consoleErrors.push(`PAGEERROR: ${err.message.slice(0, 200)}`));

  console.log('▶ 阶段 0: 初始加载');
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await waitDevReady(page);

  const body0 = await page.locator('body').innerText();
  record('加载', '首页 HTTP 200 加载', body0.length > 100 ? 'pass' : 'fail', `body 长度 ${body0.length}`);
  record('加载', '默认中文标题', body0.includes('系统就绪') || body0.includes('系统状态') ? 'pass' : 'fail', '');
  record('加载', '无致命页面错误', results.consoleErrors.filter(e => e.includes('PAGEERROR')).length === 0 ? 'pass' : 'warn',
    `${results.consoleErrors.filter(e => e.includes('PAGEERROR')).length} 个页面错误`);
  await screenshot(page, '00-initial');

  console.log('▶ 阶段 1: 语言切换 (i18n)');
  await page.evaluate(() => window.__HIVE_STORE__.getState().setLocale('en-US'));
  await page.waitForTimeout(1500);
  const bodyEn = await page.locator('body').innerText();
  record('i18n', 'EN 欢迎语', bodyEn.includes('System Ready') ? 'pass' : 'fail', '');
  record('i18n', 'EN Robot Fleet', bodyEn.includes('Robot Fleet') ? 'pass' : 'fail', '');
  record('i18n', 'EN 无中文残留', !bodyEn.includes('系统就绪') ? 'pass' : 'fail', '');
  await page.evaluate(() => window.__HIVE_STORE__.getState().setLocale('zh-CN'));
  await page.waitForTimeout(800);

  console.log('▶ 阶段 2: 7 场景数据 + 语义一致性');
  const scenarioData = {};
  for (const sc of SCENARIOS) {
    const dataSource = ['coal', 'gold', 'oil'].includes(sc) ? 'fracture' : sc;
    await page.evaluate(([ds, s]) => {
      const st = window.__HIVE_STORE__.getState();
      st.setDataSource(ds); st.setScenario(s);
      st.clearSelection();
    }, [dataSource, sc]);
    await page.waitForTimeout(1800);

    const data = await getDataset(page, dataSource, sc);
    scenarioData[sc] = data;

    record('数据', `${sc} 裂缝数>0`, data.fractures > 0 ? 'pass' : 'fail', `${data.fractures}`);
    record('数据', `${sc} 测点数>0`, data.nodes > 0 ? 'pass' : 'fail', `${data.nodes}`);
    record('数据', `${sc} 机器人>0`, data.robots > 0 ? 'pass' : 'fail', `${data.robots}`);
    record('数据', `${sc} 告警>0`, data.alerts > 0 ? 'pass' : 'fail', `${data.alerts}`);
    record('数据', `${sc} 含主/分支`, data.fractureModels.includes('main') ? 'pass' : 'warn', data.fractureModels.join(','));
    record('数据', `${sc} 传感器字段=20`, data.sampleFracture?.sensorKeys === 20 ? 'pass' : 'warn', `${data.sampleFracture?.sensorKeys}`);

    // 数据一致性: fleet 总数 = 场景机器人总数
    record('一致性', `${sc} fleet.total==robots`, data.fleetTotal === data.robots ? 'pass' : 'fail', `${data.fleetTotal} vs ${data.robots}`);
    record('一致性', `${sc} fleet.online<=total`, data.fleetOnline <= data.fleetTotal ? 'pass' : 'fail', `${data.fleetOnline}/${data.fleetTotal}`);
    record('一致性', `${sc} mesh<=robots`, data.meshConnected <= data.robots ? 'pass' : 'fail', `${data.meshConnected}/${data.robots}`);
    record('一致性', `${sc} avgConf 0-100`, data.avgConf >= 0 && data.avgConf <= 100 ? 'pass' : 'fail', `${data.avgConf}`);
    record('一致性', `${sc} onlineSensors==totalNodes`, data.totalNodes === data.nodes ? 'pass' : 'warn', `${data.totalNodes} vs ${data.nodes}`);

    // 拓扑审计
    const topo = await checkTopology(page, sc, data.fractures);
    record('拓扑', `${sc} 无 error 级问题`, topo.errors === 0 ? 'pass' : 'warn', `errors=${topo.errors}, codes=${topo.codes.join(',')}`);

    // 语义文本校验
    const scText = await page.locator('body').innerText();
    if (sc === 'coal') record('语义', 'coal 含 CH₄', scText.includes('CH₄') ? 'pass' : 'fail', '');
    if (sc === 'pipeline') record('语义', 'pipeline 含管段', scText.includes('管段') || scText.includes('管道') ? 'pass' : 'fail', '');
    if (sc === 'nuclear') record('语义', 'nuclear 含剂量/安全壳', scText.includes('剂量') || scText.includes('安全壳') ? 'pass' : 'fail', '');
    if (sc === 'refinery') record('语义', 'refinery 含 H₂S/密闭', scText.includes('H₂S') || scText.includes('密闭') ? 'pass' : 'fail', '');
    if (sc === 'underground') record('语义', 'underground 含渗透/暗流', scText.includes('渗透') || scText.includes('暗流') ? 'pass' : 'fail', '');

    await screenshot(page, `02-${sc}`);
  }

  console.log('▶ 阶段 3: 3D 点选 + 链路交互 (机器人/裂缝/节点)');
  for (const sc of SCENARIOS) {
    const dataSource = ['coal', 'gold', 'oil'].includes(sc) ? 'fracture' : sc;
    await page.evaluate(([ds, s]) => {
      const st = window.__HIVE_STORE__.getState();
      st.setDataSource(ds); st.setScenario(s); st.clearSelection();
    }, [dataSource, sc]);
    await page.waitForTimeout(2000);

    const targets = await page.evaluate(async () => window.__HIVE_TEST_API__.getInteractiveTargets());
    const robots = targets.robots || [];
    const nodes = targets.fractureNodes || [];

    // 机器人点击
    if (robots.length > 0) {
      const r = robots[0];
      await page.mouse.click(r.screen.x, r.screen.y);
      await page.waitForTimeout(600);
      const menu = page.locator('[data-testid="overlap-pick-menu"]');
      if (await menu.count()) {
        const opts = page.locator('[data-testid^="overlap-pick-option-"]');
        const cnt = await opts.count();
        if (cnt > 0) await opts.first().click();
        await page.waitForTimeout(800);
        record('交互', `${sc} 重叠菜单候选≥2`, cnt >= 2 ? 'pass' : 'warn', `${cnt}`);
      }
      const st = await getStore(page);
      record('交互', `${sc} 机器人点击→详情`, st.selectedRobot ? 'pass' : 'warn', `点 ${r.id} → ${st.selectedRobot}`);
    } else {
      record('交互', `${sc} 机器人点击`, 'warn', '无可见机器人目标');
    }

    // 关闭详情后试节点
    await page.evaluate(() => window.__HIVE_STORE__.getState().clearSelection());
    await page.waitForTimeout(300);
    if (nodes.length > 0) {
      const n = nodes[0];
      await page.mouse.click(n.screen.x, n.screen.y);
      await page.waitForTimeout(700);
      const st = await getStore(page);
      record('交互', `${sc} 节点点击→详情`, st.selectedFracture || st.selectedRobot ? 'pass' : 'warn', `点 ${n.id} → F:${st.selectedFracture} R:${st.selectedRobot}`);
    }
  }

  console.log('▶ 阶段 4: AI 对话 (mock)');
  await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    st.setDataSource('fracture'); st.setScenario('coal'); st.clearSelection();
  });
  await page.waitForTimeout(1500);

  // 测 AI: 通过 aiApi mock 路径
  const aiResult = await page.evaluate(async () => {
    const { generateMockAIResponse } = await import('/src/lib/mockAI.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const d = buildSceneDataset('fracture', 'coal');
    const tests = ['哪里最危险', '测距', '剖面', '区域框选'];
    const out = [];
    for (const q of tests) {
      const r = generateMockAIResponse(q, { fractures: d.fractures, scenario: 'coal', gasThreshold: 1.5 });
      out.push({ q, hasMsg: !!r.message, msgLen: r.message?.length ?? 0, actions: (r.actions || []).map(a => a.type) });
    }
    return out;
  });
  for (const r of aiResult) {
    record('AI', `mock 响应 "${r.q}"`, r.hasMsg && r.msgLen > 10 ? 'pass' : 'fail', `len=${r.msgLen}, actions=${r.actions.join(',')}`);
  }

  // 多场景 AI 路由
  const aiRoute = await page.evaluate(async () => {
    const { generateMockAIResponse } = await import('/src/lib/mockAI.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const out = {};
    const cases = [
      ['coal', 'fracture', '哪里最危险'],
      ['pipeline', 'pipeline', '哪里最危险'],
      ['underground', 'underground', '水压异常'],
    ];
    for (const [sc, ds, q] of cases) {
      const d = buildSceneDataset(ds, sc);
      const r = generateMockAIResponse(q, { fractures: d.fractures, scenario: sc, gasThreshold: 1 });
      out[sc] = { snippet: r.message?.slice(0, 60), actions: (r.actions || []).map(a => a.type) };
    }
    return out;
  });
  record('AI', 'coal 路由含 CH₄/瓦斯', aiRoute.coal?.snippet?.includes('CH₄') || aiRoute.coal?.snippet?.includes('瓦斯') ? 'pass' : 'warn', aiRoute.coal?.snippet);
  record('AI', 'pipeline 路由含管段/泄漏', aiRoute.pipeline?.snippet?.includes('管') || aiRoute.pipeline?.snippet?.includes('泄漏') ? 'pass' : 'warn', aiRoute.pipeline?.snippet);
  record('AI', 'underground 路由含水/渗透', aiRoute.underground?.snippet?.includes('水') || aiRoute.underground?.snippet?.includes('渗透') ? 'pass' : 'warn', aiRoute.underground?.snippet);

  console.log('▶ 阶段 5: 测量工具激活');
  for (const tool of ['distance', 'profile', 'area', 'text']) {
    await page.evaluate((t) => window.__HIVE_STORE__.getState().setActiveTool(t), tool);
    await page.waitForTimeout(500);
    const txt = await page.locator('body').innerText();
    const ok = /确认|重选|点击|Click|Confirm|Reselect|Enter/i.test(txt);
    record('工具', `激活 ${tool}`, ok ? 'pass' : 'warn', '');
    await page.evaluate(() => window.__HIVE_STORE__.getState().setActiveTool('none'));
    await page.waitForTimeout(200);
  }

  console.log('▶ 阶段 6: 导出预检 + Finding/Audit 域逻辑');
  const exportCheck = await page.evaluate(async () => {
    const { buildExportPreflight } = await import('/src/domain/exportPreflight.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const d = buildSceneDataset('fracture', 'coal');
    const r = buildExportPreflight({ format: 'pdf', pointCount: d.summary.scene.totalNodes, findingCount: 0, findings: [], includeAIInferred: true });
    return { checks: r.checks.length, passed: r.checks.filter(c => c.level === 'pass').length, status: r.status };
  });
  record('导出', '预检执行', exportCheck.checks > 0 ? 'pass' : 'fail', `${exportCheck.passed}/${exportCheck.checks} passed, status=${exportCheck.status}`);

  const findingCheck = await page.evaluate(async () => {
    const { createFindingFromAlert } = await import('/src/domain/findingFactory.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const d = buildSceneDataset('fracture', 'coal');
    const a = d.alerts[0];
    if (!a) return { ok: false };
    const f = createFindingFromAlert(a);
    return { ok: !!f, id: f?.id, evidence: f?.evidence?.length ?? 0 };
  });
  record('Finding', '告警→Finding 工厂', findingCheck.ok ? 'pass' : 'fail', `evidence=${findingCheck.evidence}`);

  const aiActionCheck = await page.evaluate(async () => {
    const { evaluateAIAction } = await import('/src/domain/aiActionPolicy.ts');
    const r = evaluateAIAction({ type: 'markPoints', points: [{ position: [0, 0, 0], label: 'x', level: 'danger' }] });
    return { allowed: r.allowed, requiresReview: r.requiresHumanReview, reason: r.reason };
  });
  record('AI审计', 'markPoints 策略评估', aiActionCheck.allowed !== undefined ? 'pass' : 'fail', `allowed=${aiActionCheck.allowed}, review=${aiActionCheck.requiresReview}`);

  const roleCheck = await page.evaluate(async () => {
    const { buildRoleDashboard } = await import('/src/domain/roleDashboard.ts');
    const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
    const d = buildSceneDataset('fracture', 'coal');
    const r = buildRoleDashboard({ fractures: d.fractures, robots: d.robots, alerts: d.alerts, findings: [] });
    return { roles: Object.keys(r) };
  });
  record('角色面板', '4 角色生成', roleCheck.roles.length >= 4 ? 'pass' : 'fail', roleCheck.roles.join(','));

  console.log('▶ 阶段 7: 拓扑连通性 (Union-Find)');
  for (const sc of ['coal', 'pipeline', 'nuclear', 'refinery', 'underground']) {
    const conn = await page.evaluate(async ([s]) => {
      const { buildSceneDataset } = await import('/src/domain/sceneDataset.ts');
      const ds = ['coal', 'gold', 'oil'].includes(s) ? 'fracture' : s;
      const d = buildSceneDataset(ds, s);
      const TOL = 1.5;
      // 采样路径点
      const pts = [];
      d.fractures.forEach((f, ci) => f.path.forEach((p, pi) => pts.push({ ci, x: p[0], y: p[1], z: p[2], pi })));
      const parent = d.fractures.map((_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (pts[i].ci === pts[j].ci) continue;
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
          if (dx * dx + dy * dy + dz * dz < TOL * TOL) union(pts[i].ci, pts[j].ci);
        }
      }
      const comps = new Set(d.fractures.map((_, i) => find(i)));
      return { fractures: d.fractures.length, components: comps.size, connected: comps.size === 1 };
    }, [sc]);
    record('连通性', `${sc} 图论连通 (1连通分量)`, conn.connected ? 'pass' : 'warn', `${conn.components} 分量 / ${conn.fractures} 通道`);
  }

  console.log('▶ 阶段 8: UI/UX 控件存在性');
  await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    st.setDataSource('fracture'); st.setScenario('coal'); st.setLocale('zh-CN'); st.clearSelection();
  });
  await page.waitForTimeout(1500);
  const uiChecks = [
    ['控制台系统状态', '系统状态'],
    ['机器人集群面板', 'Robot Fleet'],
    ['传感器趋势', '传感器趋势'],
    ['图层控制', '图层'],
    ['AI对话区', '快捷指令'],
    ['合规条', '模拟'],
    ['测量工具栏', '测距'],
  ];
  for (const [name, keyword] of uiChecks) {
    const txt = await page.locator('body').innerText();
    record('UI/UX', name, txt.includes(keyword) ? 'pass' : 'warn', `缺 "${keyword}"`);
  }

  // 图层切换
  const layerToggle = await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    const before = st.layers.pointCloud;
    st.setLayer('pointCloud', !before);
    const after = window.__HIVE_STORE__.getState().layers.pointCloud;
    st.setLayer('pointCloud', before);
    return { before, after, ok: after === !before };
  });
  record('UI/UX', '图层 toggle 生效', layerToggle.ok ? 'pass' : 'fail', '');

  // 阈值滑块
  const thresholdChange = await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    st.setGasThreshold(3.5);
    const v = window.__HIVE_STORE__.getState().gasThreshold;
    return v === 3.5;
  });
  record('UI/UX', '阈值调整生效', thresholdChange ? 'pass' : 'fail', '');

  await screenshot(page, '08-ui-overview');

  console.log('▶ 阶段 9: 回放 + 重置');
  const playback = await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    st.startPlayback();
    const playing = window.__HIVE_STORE__.getState().isPlaying;
    const active = window.__HIVE_STORE__.getState().playbackActive;
    const prog = window.__HIVE_STORE__.getState().playbackProgress;
    st.stopPlayback();
    return { playing, active, prog };
  });
  record('回放', 'startPlayback', playback.playing && playback.active && playback.prog === 0 ? 'pass' : 'fail', JSON.stringify(playback));

  const reset = await page.evaluate(() => {
    const st = window.__HIVE_STORE__.getState();
    st.setAIMarkers([{ id: 'x', position: [0, 0, 0], label: 't', level: 'danger', createdAt: 0 }]);
    st.resetSceneView();
    return window.__HIVE_STORE__.getState().aiMarkers.length;
  });
  record('回放', 'resetSceneView 清空标记', reset === 0 ? 'pass' : 'fail', `${reset} 残留`);

  console.log('▶ 阶段 10: 截图各场景最终态 (中/英)');
  for (const sc of ['coal', 'pipeline', 'nuclear', 'refinery', 'underground']) {
    const ds = ['coal', 'gold', 'oil'].includes(sc) ? 'fracture' : sc;
    await page.evaluate(([d, s]) => {
      const st = window.__HIVE_STORE__.getState();
      st.setDataSource(d); st.setScenario(s); st.setLocale('zh-CN'); st.clearSelection();
    }, [ds, sc]);
    await page.waitForTimeout(2000);
    await screenshot(page, `10-${sc}-zh`);
  }

  await browser.close();

  // 输出
  console.log('\n========== HIVE 全量测试结果 ==========');
  console.log(`总计: ${results.summary.total} | ✅ 通过: ${results.summary.passed} | ❌ 失败: ${results.summary.failed} | ⚠️ 警告: ${results.summary.warnings}`);
  console.log(`\n控制台错误数: ${results.consoleErrors.length}`);

  if (results.failures.length > 0) {
    console.log('\n--- ❌ 失败项 ---');
    results.failures.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  }
  if (results.warnings.length > 0) {
    console.log('\n--- ⚠️ 警告项 ---');
    results.warnings.forEach((f, i) => console.log(`${i + 1}. ${f}`));
  }

  console.log('\n--- 📊 各场景数据摘要 ---');
  for (const [sc, d] of Object.entries(scenarioData)) {
    console.log(`${sc}: 裂缝=${d.fractures} 测点=${d.nodes} 机器人=${d.robots}(在线${d.onlineRobots}) 告警=${d.alerts}(危${d.dangerAlerts}) avgConf=${d.avgConf}`);
  }

  // 写 JSON 报告
  const { writeFileSync } = await import('fs');
  writeFileSync('/tmp/hive-test-report.json', JSON.stringify(results, null, 2));
  console.log('\n报告已写入 /tmp/hive-test-report.json');
  console.log(`截图 ${results.screenshots.length} 张: ${results.screenshots.map(s => s.path).join(', ')}`);

  process.exit(results.summary.failed > 0 ? 1 : 0);
}

run().catch((e) => { console.error('FATAL:', e); process.exit(2); });

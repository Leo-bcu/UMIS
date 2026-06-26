import type { SceneAction, Fracture, ScenarioType } from '../types';
import type { QuickCommand } from '../types/api';
import type { Locale } from '../domain/i18nCatalog';
import { getMeasureConfig } from './sceneMeasureConfig';
import { getSceneSemantics } from './sceneSemantics';

interface AIResponse {
  message: string;
  action?: SceneAction;
  actions?: SceneAction[];
}

/** 计算裂缝中心点 */
function fractureCenter(f: Fracture): [number, number, number] {
  if (f.path.length === 0) return [0, 0, 0];
  const sum = f.path.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0]
  );
  const n = f.path.length;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** 找到 CH4 最高的裂缝 */
function findHighGasFractures(fractures: Fracture[]) {
  return fractures
    .map((f) => ({
      fracture: f,
      ch4: f.sensorReading.ch4_pct,
      temp: f.sensorReading.temperature_c,
      water: f.sensorReading.water_pressure_mpa,
      stress: f.sensorReading.stress_mpa,
      perm: f.sensorReading.permeability_md,
      micro: f.sensorReading.microseismic_count,
    }))
    .filter((x) => x.ch4 > 0)
    .sort((a, b) => b.ch4 - a.ch4);
}

export function generateMockAIResponse(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  const lowerInput = input.toLowerCase();
  const fractures = sceneContext?.fractures ?? [];
  const scenario = sceneContext?.scenario ?? 'coal';
  const gasThreshold = sceneContext?.gasThreshold ?? 1.5;
  const semantics = getSceneSemantics(scenario);
  const measureConfig = getMeasureConfig(scenario, gasThreshold);
  const isTemperatureRequest = lowerInput.includes('温度') || lowerInput.includes('高温') || lowerInput.includes('温度热力图') || lowerInput.includes('热力图') || lowerInput.includes('temperature');
  const isUndergroundHydrologyRequest = scenario === 'underground'
    && (lowerInput.includes('水压') || lowerInput.includes('涌水') || lowerInput.includes('突水') || lowerInput.includes('压力') || lowerInput.includes('地温') || lowerInput.includes('温度') || lowerInput.includes('水质') || lowerInput.includes('ph') || lowerInput.includes('矿化'))
    && !lowerInput.includes('最危险')
    && !lowerInput.includes('危险点');

  // ========== 煤矿通风盲区 / Mesh 覆盖 ==========
  if (scenario === 'coal' && (lowerInput.includes('通风') || lowerInput.includes('盲区') || lowerInput.includes('mesh') || lowerInput.includes('覆盖'))) {
    const candidates = fractures
      .map((f) => ({
        f,
        ch4: f.sensorReading.ch4_pct,
        co: f.sensorReading.co_ppm,
        temp: f.sensorReading.temperature_c,
        conn: f.connectivity,
        score: (f.connectivity <= 1 ? 35 : 0)
          + (f.sensorReading.ch4_pct >= gasThreshold ? 35 : f.sensorReading.ch4_pct * 10)
          + (f.sensorReading.co_ppm >= 24 ? 15 : 0)
          + (f.sensorReading.temperature_c > 38 ? 10 : 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const blindSpots = candidates.filter((x) => x.conn <= 1 || x.ch4 >= gasThreshold || x.co >= 24 || x.temp > 38);
    const rows = candidates
      .map((x) => `| ${x.f.id} (${x.f.name}) | ${x.conn} | ${x.ch4.toFixed(2)}% | ${x.co.toFixed(1)}ppm | ${x.temp.toFixed(1)}°C | ${x.score >= 45 ? '🔴 盲区复核' : x.score >= 25 ? '⚠️ 关注' : '🟢 正常'} |`)
      .join('\n');
    const actions: SceneAction[] = [
      { type: 'fitAll' },
      { type: 'clearMarkers' },
      { type: 'toggleLayer', layer: 'mesh', visible: true },
      { type: 'toggleLayer', layer: 'robots', visible: true },
      { type: 'toggleLayer', layer: 'pointCloud', visible: true },
    ];
    if (blindSpots.length > 0) {
      actions.push({
        type: 'markPoints',
        points: blindSpots.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 通风/Mesh复核 CH₄=${x.ch4.toFixed(2)}% CO=${x.co.toFixed(0)}ppm`,
          level: x.score >= 45 ? 'danger' as const : 'warning' as const,
        })),
      });
      actions.push({ type: 'flyTo', position: fractureCenter(blindSpots[0].f), region: `通风盲区: ${blindSpots[0].f.id}` });
    }

    return {
      message: `## 通风盲区与 Mesh 覆盖分析\n\n已展开全景视角，并打开 Mesh、机器人和点云图层。以下结果由当前巷道节点原始读数和连通性计算得出：\n\n| 区域 | 连通性 | CH₄ | CO | 温度 | 状态 |\n|------|-------|-----|----|------|------|\n${rows}\n\n> 判据：连通性≤1、CH₄ 接近/超过阈值、CO≥24ppm、温度>38°C 的区域优先纳入通风复核和 Mesh 补点。${blindSpots.length > 0 ? `\n\n已标记 **${blindSpots.length}** 个疑似通风/Mesh 薄弱点。` : ''}`,
      actions,
    };
  }

  // ========== 找出最危险的点 ==========
  if (!isTemperatureRequest && !isUndergroundHydrologyRequest && (
    lowerInput.includes('最危险') ||
    lowerInput.includes('危险点') ||
    lowerInput.includes('最危险的地方') ||
    lowerInput.includes('哪里危险') ||
    lowerInput.includes('异常') ||
    lowerInput.includes('辐射热点') ||
    lowerInput.includes('危险管段')
  )) {
    return findDangerousPoints(input, sceneContext);
  }

  // ========== 测距/剖面/框选 ==========
  const areaTitle = measureConfig.areaTitle;
  const profileTitle = measureConfig.profileTitle;

  if (lowerInput.includes('测距') || lowerInput.includes('测量距离')) {
    const slopeLabel = measureConfig.slopeAngleLabel;
    return {
      message: `## 已激活测距工具\n\n请在3D场景中点击两个点进行距离测量。\n\n测量结果将包含：\n- 三维直线距离\n- 水平距离\n- 垂直高差（带方向）\n- ${slopeLabel}\n- 方位角（含罗盘方位）`,
      actions: [{ type: 'activateTool', tool: 'distance' }],
    };
  }
  if (lowerInput.includes('剖面') || lowerInput.includes('截面')) {
    const pointLabel = measureConfig.pointLabel;
    return {
      message: `## 已激活剖面线工具\n\n请在3D场景中点击两点绘制剖面线。\n\n将生成专业${profileTitle}，包含：\n- ${pointLabel}投影分布\n- 10段密度热力带\n- 风险分级`,
      actions: [{ type: 'activateTool', tool: 'profile' }],
    };
  }
  if (lowerInput.includes('框选') || lowerInput.includes('区域分析') || lowerInput.includes('体积') || lowerInput.includes('区域地质') || lowerInput.includes('区域暗流')) {
    const features = scenario === 'pipeline' ? '小口径管段密度 & 壁厚损失\n- 泄漏检测\n- 腐蚀速率评估' :
      scenario === 'nuclear' ? '管道密度 & 剂量率分布\n- FAC速率评估\n- 疲劳使用因子' :
      scenario === 'refinery' ? '密闭空间测点密度 & H₂S 分布\n- O₂/LEL复核\n- 壁厚减薄评估' :
      scenario === 'gold' ? '裂缝密度 & 应力分布\n- 微震活动评估\n- 风险等级' :
      scenario === 'oil' ? '裂缝密度 & 孔隙压力\n- 渗透率评估\n- 含油饱和度' :
      scenario === 'underground' ? '通道密度 & 渗透率分布\n- 矿化度评估\n- 地温梯度' :
      '裂缝密度 & 渗透率\n- RQD 岩质分级\n- 风险等级评估';
    return {
      message: `## 已激活区域框选工具\n\n请在3D场景中拖拽选择一个立方体区域。\n\n将生成完整${areaTitle}报告，包含：\n- ${features}`,
      actions: [{ type: 'activateTool', tool: 'area' }],
    };
  }

  // ========== 全景/重置 ==========
  if (lowerInput.includes('全景') || lowerInput.includes('重置') || lowerInput.includes('全图') || lowerInput.includes('home')) {
    const sceneLabel = scenario === 'pipeline' ? '小口径管道网络' : scenario === 'nuclear' ? '反应堆管道' : scenario === 'refinery' ? '化工密闭空间' : scenario === 'underground' ? '地下暗流通道' : scenario === 'coal' ? '煤矿巷道/裂隙网络' : '裂缝网络';
    return {
      message: `## 已重置到全景视角\n\n当前场景展示全部${sceneLabel}。`,
      actions: [
        { type: 'fitAll' },
        { type: 'clearMarkers' },
      ],
    };
  }

  // ========== 清除标记 ==========
  if (lowerInput.includes('清除标记') || lowerInput.includes('清掉')) {
    return {
      message: `已清除3D场景中所有AI标记。`,
      actions: [{ type: 'clearMarkers' }],
    };
  }

  // ========== 切换场景 ==========
  if (lowerInput.includes('金矿') || lowerInput.includes('切到金矿')) {
    return {
      message: `## 已切换到金矿场景\n\n当前监测金矿巷道裂缝网络，重点关注岩爆风险。`,
      actions: [{ type: 'switchScenario', scenario: 'gold' }],
    };
  }
  if (lowerInput.includes('油气') || lowerInput.includes('石油')) {
    return {
      message: `## 已切换到油气场景\n\n当前监测油气储层裂缝网络，重点关注渗透率和产能。`,
      actions: [{ type: 'switchScenario', scenario: 'oil' }],
    };
  }
  if (lowerInput.includes('煤矿') || lowerInput.includes('切到煤矿')) {
    return {
      message: `## 已切换到煤矿瓦斯巡测场景\n\n当前监测矿井巷道切片和微型机器人集群，重点关注 CH₄、CO、O₂、温度和通风盲区。`,
      actions: [{ type: 'switchScenario', scenario: 'coal' }],
    };
  }

  // ========== 裂缝分布概览 ==========
  if ((lowerInput.includes('裂缝') || lowerInput.includes('暗流') || lowerInput.includes('通道')) && (lowerInput.includes('分布') || lowerInput.includes('概览') || lowerInput.includes('多少条') || lowerInput.includes('网络'))) {
    if (fractures.length === 0) {
      return {
        message: `当前场景尚未加载${semantics.networkLabel}数据，请稍候。`,
        actions: [{ type: 'fitAll' }],
      };
    }

    const mainFractures = fractures.filter((f) => f.type === 'main');
    const branchFractures = fractures.filter((f) => f.type === 'branch');
    const avgConn = fractures.reduce((s, f) => s + f.connectivity, 0) / fractures.length;
    const avgFractal = fractures.reduce((s, f) => s + f.fractal_dim, 0) / fractures.length;

    if (scenario === 'underground') {
      const highPerm = fractures.filter((f) => f.sensorReading.permeability_md >= semantics.trend.primary.threshold);
      const hotChannels = fractures.filter((f) => f.sensorReading.temperature_c >= semantics.trend.temperature.threshold);
      return {
        message: `## 地下暗流通道网络概览\n\n当前探测区域共识别 **${fractures.length} 段暗流通道**：\n\n| 类型 | 数量 | 平均长度 | 平均通道直径 |\n|------|------|---------|------------|\n| 主干通道 | ${mainFractures.length} 段 | ${Math.round(mainFractures.reduce((s, f) => s + f.length, 0) / Math.max(mainFractures.length, 1))}m | ${(mainFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(mainFractures.length, 1) / 1000).toFixed(2)}m |\n| 分支通道 | ${branchFractures.length} 段 | ${Math.round(branchFractures.reduce((s, f) => s + f.length, 0) / Math.max(branchFractures.length, 1))}m | ${(branchFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(branchFractures.length, 1) / 1000).toFixed(2)}m |\n\n平均连通性 **${avgConn.toFixed(2)}**，高渗透通道 **${highPerm.length}** 段，地温异常通道 **${hotChannels.length}** 段。\n\n已展开全景视角，地下暗流通道网络已高亮。`,
        actions: [
          { type: 'fitAll' },
          { type: 'clearMarkers' },
        ],
      };
    }

    return {
      message: `## 裂缝网络分布概览\n\n当前探测区域共识别 **${fractures.length} 条裂缝**：\n\n| 类型 | 数量 | 平均长度 | 平均开度 |\n|------|------|---------|--------|\n| 主裂缝 | ${mainFractures.length} 条 | ${Math.round(mainFractures.reduce((s, f) => s + f.length, 0) / Math.max(mainFractures.length, 1))}m | ${Math.round(mainFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(mainFractures.length, 1))}µm |\n| 分支裂缝 | ${branchFractures.length} 条 | ${Math.round(branchFractures.reduce((s, f) => s + f.length, 0) / Math.max(branchFractures.length, 1))}m | ${Math.round(branchFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(branchFractures.length, 1))}µm |\n\n裂缝网络分形维数 **${avgFractal.toFixed(2)}**，平均连通性 **${avgConn.toFixed(2)}**。\n\n已展开全景视角，所有裂缝网络已高亮。`,
      actions: [
        { type: 'fitAll' },
        { type: 'clearMarkers' },
      ],
    };
  }

  // ========== 地下暗流场景特定分析（放在通用压力/温度/浓度分支之前，避免串到裂缝/瓦斯话术） ==========
  if (scenario === 'underground') {
    if (lowerInput.includes('水压') || lowerInput.includes('涌水') || lowerInput.includes('突水') || lowerInput.includes('压力')) {
      const waterSorted = fractures.map(f => ({ f, water: f.sensorReading.water_pressure_mpa, perm: f.sensorReading.permeability_md }))
        .sort((a, b) => b.water - a.water);
      const top = waterSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.water.toFixed(1)}MPa | ${x.perm.toFixed(0)}mD | ${x.water > 8 ? '🔴 高压' : x.water > 5 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      return {
        message: `## 地下暗流水压异常分析\n\n| 通道 | 水压 | 渗透率 | 状态 |\n|------|------|--------|------|\n${rows}\n\n> 水压 > 8MPa 且渗透率 > 5000mD 的通道需要优先确认连通边界和排水能力。`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
    if (lowerInput.includes('地温') || lowerInput.includes('温度') || lowerInput.includes('热')) {
      const tempSorted = fractures.map(f => ({ f, temp: f.sensorReading.temperature_c, water: f.sensorReading.water_pressure_mpa }))
        .sort((a, b) => b.temp - a.temp);
      const top = tempSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.temp.toFixed(0)}°C | ${x.water.toFixed(1)}MPa | ${x.temp > 90 ? '🔴 异常' : x.temp > 70 ? '⚠️ 偏高' : '🟢 正常'} |`).join('\n');
      return {
        message: `## 地温梯度分析\n\n| 通道 | 地温 | 水压 | 状态 |\n|------|------|------|------|\n${rows}\n\n> 高地温区建议与水化学、流速和机器人耐温余量一起复核。`,
        actions: [{ type: 'clearMarkers' }, { type: 'toggleLayer', layer: 'tempHeatmap', visible: true }],
      };
    }
    if (lowerInput.includes('水质') || lowerInput.includes('ph') || lowerInput.includes('矿化')) {
      const quality = fractures.map(f => ({ f, ph: f.sensorReading.fluid_ph, mineral: f.sensorReading.co_ppm, h2s: f.sensorReading.h2s_ppm }))
        .sort((a, b) => Math.abs(7 - b.ph) - Math.abs(7 - a.ph))
        .slice(0, 5);
      const rows = quality.map(x => `| ${x.f.id} (${x.f.name}) | ${x.ph.toFixed(1)} | ${x.mineral.toFixed(0)}mg/L | ${x.h2s.toFixed(1)}ppm | ${x.ph < 5.5 || x.ph > 8.5 ? '⚠️ 复核' : '🟢 正常'} |`).join('\n');
      return {
        message: `## 地下暗流水质异常分析\n\n| 通道 | pH | 矿化度估算 | H₂S | 状态 |\n|------|----|----------|-----|------|\n${rows}\n\n> 水质指标为机器人原位传感器 Mock 原始值聚合，正式报告需结合取样化验校准。`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
  }

  // ========== CO 浓度分析（煤矿专用，必须先于"浓度/气体"泛化分支） ==========
  if (scenario === 'coal' && (lowerInput.includes('co') || lowerInput.includes('一氧化碳') || lowerInput.includes('阴燃'))) {
    const sorted = fractures
      .map((f) => ({ fracture: f, co: f.sensorReading.co_ppm, ch4: f.sensorReading.ch4_pct, temp: f.sensorReading.temperature_c }))
      .sort((a, b) => b.co - a.co);
    const top = sorted.slice(0, 6);
    const warning = top.filter((x) => x.co >= 24);
    const danger = top.filter((x) => x.co >= 50);

    const rows = top
      .map((x) => {
        const status = x.co >= 50 ? '🔴 高风险' : x.co >= 24 ? '⚠️ 关注' : '🟢 正常';
        return `| ${x.fracture.id} (${x.fracture.name}) | ${x.co.toFixed(1)}ppm | ${x.ch4.toFixed(2)}% | ${x.temp.toFixed(1)}°C | ${status} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [
      { type: 'fitAll' },
      { type: 'clearMarkers' },
    ];
    if (warning.length > 0) {
      actions.push({
        type: 'markPoints',
        points: warning.map((x) => ({
          position: fractureCenter(x.fracture),
          label: `${x.fracture.id} CO=${x.co.toFixed(1)}ppm`,
          level: x.co >= 50 ? 'danger' : 'warning',
        })),
      });
      actions.push({
        type: 'flyTo',
        position: fractureCenter(warning[0].fracture),
        region: `CO最高: ${warning[0].fracture.id}`,
      });
    }

    return {
      message: `## CO 浓度分析\n\n已展开全景视角，并标记 CO 高值测点。当前版本尚未接入独立 CO 连续热力图层，因此不使用 CH₄ 热力图冒充 CO；以下分布来自巷道节点 CO 原始读数聚合。\n\n| 巷道/测点 | CO | CH₄ | 温度 | 状态 |\n|------|----|-----|------|------|\n${rows}\n\n**判据**：CO 24-50ppm 需关注，>50ppm 需复核通风、阴燃和人员进入边界。\n\n${danger.length > 0 ? `🔴 共 **${danger.length}** 处 CO 高风险点，已标记并聚焦最高值区域。` : warning.length > 0 ? `⚠️ 共 **${warning.length}** 处 CO 关注点，已标记供复核。` : '当前 CO 浓度未超过关注阈值。'}`,
      actions,
    };
  }

  // ========== 瓦斯浓度分析 ==========
  if (lowerInput.includes('瓦斯') || lowerInput.includes('ch4') || lowerInput.includes('气体') || lowerInput.includes('甲烷') || lowerInput.includes('浓度')) {
    const sorted = findHighGasFractures(fractures);
    const dangerous = sorted.filter((x) => x.ch4 >= gasThreshold).slice(0, 5);
    const allAbove = sorted.filter((x) => x.ch4 >= gasThreshold);

    const tableRows = sorted.slice(0, 6)
      .map((x) => {
        const status = x.ch4 >= 1.5 ? '🔴 危险' : x.ch4 >= gasThreshold ? '⚠️ 超标' : '🟢 正常';
        return `| ${x.fracture.id} (${x.fracture.name}) | ${x.ch4.toFixed(2)}% | ${status} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [
      { type: 'clearMarkers' },
      { type: 'toggleLayer', layer: 'gasHeatmap', visible: true },
    ];

    // 标记危险裂缝
    if (dangerous.length > 0) {
      actions.push({
        type: 'markPoints',
        points: dangerous.map((x) => ({
          position: fractureCenter(x.fracture),
          label: `${x.fracture.id} CH4=${x.ch4.toFixed(2)}% ${x.ch4 >= 1.5 ? '🔴' : '⚠️'}`,
          level: (x.ch4 >= 1.5 ? 'danger' : 'warning') as 'danger' | 'warning',
        })),
      });
      // 飞到最危险的
      actions.push({
        type: 'flyTo',
        position: fractureCenter(dangerous[0].fracture),
        region: `最高瓦斯: ${dangerous[0].fracture.id}`,
      });
    }

    return {
      message: `## 瓦斯浓度分析\n\n已开启瓦斯热力图，数据来自裂缝节点传感器。\n\n| 裂缝 | CH₄浓度 | 状态 |\n|------|---------|------|\n${tableRows}\n\n**安全阈值**: ${gasThreshold.toFixed(1)}% (报警) / 1.5% (断电)\n\n${allAbove.length > 0 ? `⚠️ 共 **${allAbove.length}** 处裂缝瓦斯超标，已标记并飞行到最高浓度区域。` : '✅ 当前所有裂缝瓦斯浓度在安全范围内。'}`,
      actions,
    };
  }

  // ========== 应力场分析 ==========
  if (lowerInput.includes('应力') || lowerInput.includes('压力') || lowerInput.includes('stress') || lowerInput.includes('稳定性') || lowerInput.includes('岩爆')) {
    const stressSorted = fractures
      .filter((f) => f.sensorReading.stress_mpa > 0)
      .map((f) => ({ f, stress: f.sensorReading.stress_mpa, sigma1: f.sensorReading.stress_sigma1, sigma3: f.sensorReading.stress_sigma3, micro: f.sensorReading.microseismic_count }))
      .sort((a, b) => b.stress - a.stress);
    const top = stressSorted.slice(0, 5);

    const tableRows = top
      .map((x) => {
        const ratio = x.sigma3 > 0 ? (x.sigma1 / x.sigma3).toFixed(2) : '—';
        const risk = x.stress > 12 ? '🔴 高' : x.stress > 8 ? '⚠️ 中' : '🟢 低';
        return `| ${x.f.id} | ${x.stress.toFixed(1)} | ${x.sigma1.toFixed(1)} | ${x.sigma3.toFixed(1)} | ${ratio} | ${x.micro}/h | ${risk} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [{ type: 'clearMarkers' }];

    // 标记应力集中区
    if (top.length > 0) {
      const stressPoints = top
        .filter((x) => x.stress > 8)
        .map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} σ₁=${x.stress.toFixed(1)}MPa ${x.micro > 15 ? '微震活跃' : ''}`,
          level: (x.stress > 12 ? 'danger' : 'warning') as 'danger' | 'warning',
        }));
      if (stressPoints.length > 0) {
        actions.push({ type: 'markPoints', points: stressPoints });
      }
      // 切换裂缝着色为应力模式
      actions.push({ type: 'setColorMode', mode: 'stress' });
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `应力集中: ${top[0].f.id}`,
      });
    }

    return {
      message: `## 地应力场分析\n\n基于三轴应力测量数据，已标记应力集中区域：\n\n| 裂缝 | 最大主应力 σ₁ (MPa) | σ₁ 值 | σ₃ 值 | σ₁/σ₃ | 微震/h | 岩爆风险 |\n|------|-------|-------|-------|-------|--------|--------|\n${tableRows}\n\n### 岩爆判据\n- σ₁/σ₃ > 2.0 → 需关注岩爆风险\n- 微震事件 > 15次/h → 需撤离\n\n${top[0] && top[0].micro > 15 ? `⚠️ **${top[0].f.id}** 微震事件 ${top[0].micro}/h 超过警戒线！` : '当前微震活动处于关注级别。'}`,
      actions,
    };
  }

  // ========== 渗透率评估 ==========
  if (lowerInput.includes('渗透') || lowerInput.includes('permeability') || lowerInput.includes('抽采')) {
    const permSorted = fractures
      .filter((f) => f.sensorReading.permeability_md > 0)
      .map((f) => ({
        f,
        perm: f.sensorReading.permeability_md,
        aperture: f.aperture_um,
        conn: f.connectivity,
      }))
      .sort((a, b) => b.perm - a.perm);
    const top = permSorted.slice(0, 6);

    const tableRows = top
      .map((x) => {
        if (scenario === 'underground') {
          const quality = x.perm > 10000 ? '🔴 极高（需复核水压）' : x.perm > 5000 ? '⚠️ 高渗透' : '🟢 正常';
          return `| ${x.f.id} (${x.f.name}) | ${x.perm.toFixed(0)} | ${(x.aperture / 1000).toFixed(2)}m | ${x.conn.toFixed(2)} | ${quality} |`;
        }
        const quality = x.perm > 2.0 ? '🟢 高（适合抽采）' : x.perm > 0.5 ? '🟡 中' : '🔴 低';
        return `| ${x.f.id} (${x.f.name}) | ${x.perm.toFixed(2)} | ${x.aperture.toFixed(0)}µm | ${x.conn.toFixed(2)} | ${quality} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [{ type: 'clearMarkers' }];

    // 标记高渗透率裂缝（适合抽采）
    const highPerm = top.filter((x) => scenario === 'underground' ? x.perm > 5000 : x.perm > 1.0);
    if (highPerm.length > 0) {
      actions.push({
        type: 'markPoints',
        points: highPerm.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 渗透率=${scenario === 'underground' ? x.perm.toFixed(0) : x.perm.toFixed(2)}mD ${scenario === 'underground' ? '高渗透通道' : '抽采通道'}`,
          level: 'info' as const,
        })),
      });
      // 切换裂缝着色模式为渗透率（不用热力图，用裂缝面颜色映射）
      actions.push({ type: 'setColorMode', mode: 'permeability' });
    }
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高渗透率: ${top[0].f.id}`,
      });
    }

    if (scenario === 'underground') {
      return {
        message: `## 地下暗流渗透率评估\n\n基于通道测点的渗透率、水压与连通性数据，已标记高渗透暗流通道：\n\n| 通道 | 渗透率 (mD) | 通道直径 | 连通性 | 评价 |\n|------|-----------|--------|--------|------|\n${tableRows}\n\n> 渗透率 > 5000 mD 的通道应优先复核水压、地温与连通边界。\n\n${highPerm.length > 0 ? `⚠️ 已标记 **${highPerm.length}** 段高渗透通道，建议纳入重点复测和排水边界校核。` : '当前暗流通道渗透率处于可控范围。'}`,
        actions,
      };
    }

    return {
      message: `## 渗透率评估\n\n基于应力-渗透率耦合分析（SD模型），已标记高渗透率裂缝：\n\n| 裂缝 | 渗透率 (mD) | 开度 | 连通性 | 评价 |\n|------|-----------|------|--------|------|\n${tableRows}\n\n> 渗透率 > 1.0 mD 的裂缝可作为瓦斯抽采通道。\n\n${highPerm.length > 0 ? `✅ 已标记 **${highPerm.length}** 条高渗透率裂缝，建议在这些位置布置抽采钻孔。已飞行到渗透率最高区域。` : '当前裂缝渗透率普遍偏低。'}`,
      actions,
    };
  }

  // ========== 温度分析 ==========
  if (isTemperatureRequest || lowerInput.includes('热')) {
    const tempSorted = fractures
      .filter((f) => f.sensorReading.temperature_c > 0)
      .map((f) => ({ f, temp: f.sensorReading.temperature_c }))
      .sort((a, b) => b.temp - a.temp);
    const top = tempSorted.slice(0, 5);

    const actions: SceneAction[] = [
      { type: 'fitAll' },
      { type: 'clearMarkers' },
      { type: 'toggleLayer', layer: 'tempHeatmap', visible: true },
    ];
    const hot = top.filter((x) => x.temp > 38);
    if (hot.length > 0) {
      actions.push({
        type: 'markPoints',
        points: hot.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 温度=${x.temp.toFixed(1)}°C`,
          level: x.temp > 45 ? 'danger' as const : 'warning' as const,
        })),
      });
    }
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高温度: ${top[0].f.id}`,
      });
    }

    const tableRows = top.map((x) => `| ${x.f.id} | ${x.temp.toFixed(1)}°C | ${x.temp > 45 ? '🔴 高温危险' : x.temp > 38 ? '⚠️ 异常' : '🟢 正常'} |`).join('\n');

    return {
      message: `## 温度场分析\n\n已展开全景视角、开启温度热力图，并标记高温危险点位：\n\n| 裂缝 | 温度 | 状态 |\n|------|------|------|\n${tableRows}\n\n> 地温梯度约 3.0°C/100m，属于正常地温带。温度异常区需结合 CH₄、CO 和通风状态复核。${hot.length > 0 ? `\n\n已标记 **${hot.length}** 个高温异常点。` : ''}`,
      actions,
    };
  }

  // ========== 突水预警 ==========
  if (lowerInput.includes('突水') || lowerInput.includes('涌水') || lowerInput.includes('water')) {
    const waterSorted = fractures
      .filter((f) => f.sensorReading.water_pressure_mpa > 0)
      .map((f) => ({ f, water: f.sensorReading.water_pressure_mpa }))
      .sort((a, b) => b.water - a.water);
    const top = waterSorted.slice(0, 5);

    const actions: SceneAction[] = [{ type: 'clearMarkers' }];
    const danger = top.filter((x) => x.water > 5);
    if (danger.length > 0) {
      actions.push({
        type: 'markPoints',
        points: danger.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 水压=${x.water.toFixed(1)}MPa 🔴`,
          level: 'danger' as const,
        })),
      });
    }
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高水压: ${top[0].f.id}`,
      });
    }

    const tableRows = top.map((x) => `| ${x.f.id} | ${x.water.toFixed(1)} | ${x.water > 5 ? '🔴 危险' : x.water > 3 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');

    return {
      message: `## 突水预警分析\n\n当前水压监测数据：\n\n| 裂缝 | 水压 (MPa) | 风险等级 |\n|------|----------|--------|\n${tableRows}\n\n${danger.length > 0 ? `🔴 **${danger.length}** 处裂缝水压接近临界值，存在突水风险！` : '✅ 当前水压数据正常。'}`,
      actions,
    };
  }

  // ========== 特定裂缝风险评估 (F-xxx) ==========
  const fractureMatch = fractures.find(
    (f) => lowerInput.includes(f.id.toLowerCase()) || lowerInput.includes(f.name.toLowerCase())
  );
  if (fractureMatch && (lowerInput.includes('风险') || lowerInput.includes('评估') || lowerInput.includes('分析'))) {
    return analyzeFracture(fractureMatch, gasThreshold);
  }

  // ========== 实验指令 ==========
  if (lowerInput.includes('实验') || lowerInput.includes('测试') || lowerInput.includes('模拟') || lowerInput.includes('压裂')) {
    return {
      message: scenario === 'underground'
        ? `## 可用虚拟实验\n\n请在3D场景中选中暗流通道后，在右侧面板执行实验：\n\n| 实验 | 描述 |\n|------|------|\n| 渗透率评估 | 计算通道等效渗透率 |\n| 水压异常 | 复核承压水边界 |\n| 地温梯度 | 识别高地温通道 |\n| 水质异常 | 分析 pH、矿化度和 H₂S |\n| 连通性分析 | 分析暗流网络连通性 |\n\n> 提示：点击3D场景中的暗流通道可选中并查看详情面板。`
        : `## 可用虚拟实验\n\n请在3D场景中选中裂缝后，在右侧面板执行实验：\n\n| 实验 | 描述 |\n|------|------|\n| 瓦斯扩散模拟 | 预测CH₄扩散路径 |\n| 稳定性评估 | 评估围岩稳定性 |\n| 突水预警 | 计算突水风险等级 |\n| 岩爆预测 | 基于微震和应力 |\n| 渗透率评估 | 计算等效渗透率 |\n| 裂缝连通性 | 分析网络连通性 |\n\n> 提示：点击3D场景中的裂缝线可选中并查看详情面板。`,
      actions: [],
    };
  }

  // ========== 机器人状态 ==========
  if (lowerInput.includes('机器人') || lowerInput.includes('状态') || lowerInput.includes('群智') || lowerInput.includes('设备')) {
    return {
      message: `## 机器人集群状态\n\n当前部署的仿生探测机器人沿${semantics.networkLabel}分布，实时回传传感器数据。\n\n左侧"机器人集群"面板可查看完整列表，点击告警可飞行到对应机器人位置。`,
      actions: [],
    };
  }

  // ========== 管线场景特定分析 ==========
  if (scenario === 'pipeline') {
    // 管网概览
    if (lowerInput.includes('管网') && (lowerInput.includes('分布') || lowerInput.includes('概览') || lowerInput.includes('情况'))) {
      const mainPipes = fractures.filter(f => f.type === 'main');
      const branchPipes = fractures.filter(f => f.type === 'branch');
      const leakRisk = fractures.filter(f => f.sensorReading.ch4_pct > 20);
      return {
        message: `## 管网分布概览\n\n当前监测区域共 **${fractures.length}** 段管道：\n\n| 类型 | 数量 | 平均长度 |\n|------|------|---------|\n| 主干线 | ${mainPipes.length} | ${Math.round(mainPipes.reduce((s,f)=>s+f.length,0)/Math.max(mainPipes.length,1))}m |\n| 支线 | ${branchPipes.length} | ${Math.round(branchPipes.reduce((s,f)=>s+f.length,0)/Math.max(branchPipes.length,1))}m |\n\n⚠️ **${leakRisk.length}** 段管道泄漏浓度超20%LEL，建议优先巡检。`,
        actions: [{ type: 'fitAll' }, { type: 'clearMarkers' }],
      };
    }
    // 泄漏检测
    if (lowerInput.includes('泄漏') || lowerInput.includes('漏气') || lowerInput.includes('天然气')) {
      const leakSorted = fractures.map(f => ({ f, leak: f.sensorReading.ch4_pct, h2s: f.sensorReading.h2s_ppm }))
        .filter(x => x.leak > 0).sort((a,b) => b.leak - a.leak);
      const top = leakSorted.slice(0, 5);
      const danger = top.filter(x => x.leak > 20);
      const rows = top.map(x => `| ${x.f.id} | ${x.leak.toFixed(1)}%LEL | ${x.h2s.toFixed(0)}ppm | ${x.leak > 20 ? '🔴 危险' : x.leak > 10 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} 泄漏=${x.leak.toFixed(1)}%LEL`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `泄漏: ${danger[0].f.id}` });
      }
      return {
        message: `## 可燃气体泄漏检测\n\n| 管段 | 泄漏浓度 | H₂S | 状态 |\n|------|---------|-----|------|\n${rows}\n\n安全阈值: 20%LEL (报警) / NACE MR0175 H₂S: 50ppm\n\n${danger.length > 0 ? `🔴 **${danger.length}** 段管道泄漏超标！` : '✅ 当前泄漏浓度在安全范围内。'}`,
        actions,
      };
    }
    // 壁厚/腐蚀
    if (lowerInput.includes('壁厚') || lowerInput.includes('腐蚀') || lowerInput.includes('厚度')) {
      const corrSorted = fractures.map(f => ({ f, corr: f.sensorReading.permeability_md, wtLoss: f.sensorReading.rock_strength_mpa }))
        .sort((a,b) => b.corr - a.corr);
      const top = corrSorted.slice(0, 6);
      const rows = top.map(x => `| ${x.f.id} | ${x.corr.toFixed(3)} mm/yr | ${x.wtLoss.toFixed(1)}% | ${x.corr > 0.25 ? '🔴 高' : x.corr > 0.1 ? '⚠️ 中' : '🟢 低'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (top.length > 0) actions.push({ type: 'flyTo', position: fractureCenter(top[0].f), region: `腐蚀最严重: ${top[0].f.id}` });
      return {
        message: `## 管道壁厚腐蚀评估\n\n基于超声测厚数据，阴极保护电位分析：\n\n| 管段 | 腐蚀速率 | 壁厚损失 | 风险 |\n|------|---------|---------|------|\n${rows}\n\n> ASME B31.8: 屈服利用率>72%需降压运行\n> 腐蚀速率>0.3mm/yr需更换管段`,
        actions,
      };
    }
    // H₂S
    if (lowerInput.includes('硫化氢') || lowerInput.includes('h2s') || lowerInput.includes('h₂s')) {
      const h2sSorted = fractures.map(f => ({ f, h2s: f.sensorReading.h2s_ppm }))
        .filter(x => x.h2s > 0).sort((a,b) => b.h2s - a.h2s);
      const top = h2sSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} | ${x.h2s.toFixed(0)} ppm | ${x.h2s > 50 ? '🔴 超NACE阈值' : x.h2s > 20 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      return {
        message: `## H₂S 硫化氢监测\n\n| 管段 | H₂S浓度 | 状态 |\n|------|---------|------|\n${rows}\n\n> NACE MR0175: 酸性服务阈值50ppm，超阈值需更换为抗硫管材`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
    // 屈服强度
    if (lowerInput.includes('屈服') || lowerInput.includes('强度校核') || lowerInput.includes('应力')) {
      const yieldSorted = fractures.map(f => ({ f, util: f.sensorReading.stress_sigma1, yield: f.sensorReading.stress_sigma3, op: f.sensorReading.stress_mpa }))
        .sort((a,b) => b.util - a.util);
      const top = yieldSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} | X${Math.round(x.yield/6.9)} | ${x.op.toFixed(1)} | ${x.util.toFixed(1)}% | ${x.util > 72 ? '🔴 超标' : x.util > 50 ? '⚠️ 偏高' : '🟢 安全'} |`).join('\n');
      return {
        message: `## 管道屈服强度校核\n\n基于运行压力×管径/(2×壁厚)计算环向应力：\n\n| 管段 | 钢级 | 运行压力 | 屈服利用率 | 状态 |\n|------|------|---------|----------|------|\n${rows}\n\n> ASME B31.8: 屈服利用率报警阈值72%`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
  }

  // ========== 核反应堆场景特定分析 ==========
  if (scenario === 'nuclear') {
    // 管道网络概览
    if (lowerInput.includes('管道') && (lowerInput.includes('概览') || lowerInput.includes('分布') || lowerInput.includes('网络') || lowerInput.includes('情况'))) {
      const primary = fractures.filter(f => f.sensorReading.stress_mpa >= 15);
      const secondary = fractures.filter(f => f.sensorReading.stress_mpa < 15 && f.sensorReading.stress_mpa > 3);
      const aux = fractures.filter(f => f.sensorReading.stress_mpa <= 3);
      const hotspots = fractures.filter(f => f.sensorReading.ch4_pct > 25);
      return {
        message: `## 核反应堆管道网络概览\n\nPWR 四环路压水堆管道系统，共 **${fractures.length}** 段：\n\n| 等级 | 数量 | 说明 |\n|------|------|------|\n| Class 1 一回路 | ${primary.length} | 15.5MPa, 293-327°C, SS316LN |\n| Class 2 二回路 | ${secondary.length} | 5.5-7.8MPa, 180-290°C, A106 Gr.C |\n| Class 3 辅助 | ${aux.length} | ECCS/CVCS/CCWS |\n\n${hotspots.length > 0 ? `⚠️ **${hotspots.length}** 段管道剂量率超25 mSv/h控制目标。` : '✅ 辐射剂量率在控制范围内。'}`,
        actions: [{ type: 'fitAll' }, { type: 'clearMarkers' }],
      };
    }
    // 剂量率
    if (lowerInput.includes('剂量') || lowerInput.includes('辐射') || lowerInput.includes('辐射热点') || lowerInput.includes('放射')) {
      const doseSorted = fractures.map(f => ({ f, dose: f.sensorReading.ch4_pct }))
        .filter(x => x.dose > 0).sort((a,b) => b.dose - a.dose);
      const top = doseSorted.slice(0, 5);
      const danger = top.filter(x => x.dose > 25);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.dose.toFixed(1)} mSv/h | ${x.dose > 25 ? '🔴 超控制目标' : x.dose > 10 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} 剂量率=${x.dose.toFixed(1)}mSv/h`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `辐射热点: ${danger[0].f.id}` });
      }
      return {
        message: `## 辐射剂量率分析\n\n基于γ剂量仪巡测数据：\n\n| 管道 | 剂量率 | 状态 |\n|------|--------|------|\n${rows}\n\n> 控制区管理目标: 25 mSv/h\n> 职业照射限值: 20 mSv/yr (GB 18871)\n\n${danger.length > 0 ? `🔴 **${danger.length}** 段管道辐射超标，建议限制人员接近！` : '✅ 当前剂量率在管理目标范围内。'}`,
        actions,
      };
    }
    // 疲劳
    if (lowerInput.includes('疲劳') || lowerInput.includes('fatigue')) {
      const fatSorted = fractures.map(f => ({ f, fat: f.sensorReading.water_pressure_mpa }))
        .sort((a,b) => b.fat - a.fat);
      const top = fatSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${(x.fat).toFixed(1)}% | ${x.fat > 60 ? '🔴 报警' : x.fat > 40 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      return {
        message: `## 管道疲劳累积损伤评估\n\n基于应变片在线监测 + 瞬态记录仪数据：\n\n| 管道 | 疲劳使用因子 | 状态 |\n|------|------------|------|\n${rows}\n\n> ASME Section III: 疲劳使用因子要求<1.0\n> 报警阈值: 0.6（需加强监测）\n> 达1.0需缺陷评定或更换`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
    // FAC
    if (lowerInput.includes('fac') || lowerInput.includes('流动加速腐蚀') || lowerInput.includes('腐蚀')) {
      const facSorted = fractures.map(f => ({ f, fac: f.sensorReading.permeability_md }))
        .filter(x => x.fac > 0).sort((a,b) => b.fac - a.fac);
      const top = facSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} | ${x.fac.toFixed(3)} mm/yr | ${(x.fac * 10).toFixed(1)} mm | ${x.fac > 0.1 ? '🔴 超EPRI阈值' : x.fac > 0.05 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      return {
        message: `## FAC 流动加速腐蚀监测\n\n二回路碳钢管道重点风险（EPRI CHECKWORKS评估）：\n\n| 管道 | FAC速率 | 预测壁厚减薄 | 状态 |\n|------|--------|-----------|------|\n${rows}\n\n> EPRI关注阈值: 0.1 mm/yr\n> 年检管道: FAC速率>0.05mm/yr\n> 建议管材升级: SS316L 替换 A106 Gr.C`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
    // 冷却剂活度
    if (lowerInput.includes('活度') || lowerInput.includes('冷却剂') || lowerInput.includes('放射性') || lowerInput.includes('核素')) {
      const actSorted = fractures.filter(f => f.sensorReading.h2s_ppm > 0)
        .map(f => ({ f, act: f.sensorReading.h2s_ppm }))
        .sort((a,b) => b.act - a.act);
      const top = actSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} | ${x.act.toFixed(2)} Bq/mL | ${x.act > 5 ? '🔴 包壳破损疑似' : x.act > 2 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      return {
        message: `## 冷却剂放射性活度分析\n\n基于一回路取样分析（γ谱仪 Cs-137/Cs-134）：\n\n| 管道 | 冷却剂活度 | 状态 |\n|------|----------|------|\n${rows}\n\n> 包壳破损判据: 5 Bq/mL (Cs-137等效)\n> 正常运行: <1 Bq/mL\n> 燃料完整性监测: 活度趋势分析`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
    // 振动
    if (lowerInput.includes('振动') || lowerInput.includes('vibration') || lowerInput.includes('振幅')) {
      const vibSorted = fractures.map(f => ({ f, vib: f.sensorReading.microseismic_count }))
        .sort((a,b) => b.vib - a.vib);
      const top = vibSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} | ${x.vib.toFixed(1)} mm/s | ${x.vib > 7.1 ? '🔴 C级报警' : x.vib > 4.5 ? '⚠️ B级关注' : '🟢 A级正常'} |`).join('\n');
      return {
        message: `## 管道振动状态评估\n\n基于三轴加速度计测量（ISO 10816评估标准）：\n\n| 管道 | 振动速度 | 等级 |\n|------|---------|------|\n${rows}\n\n> ISO 10816:\n> A级 <4.5mm/s — 优良\n> B级 4.5-7.1mm/s — 合格\n> C级 >7.1mm/s — 报警\n> D级 >11.2mm/s — 危险`,
        actions: [{ type: 'clearMarkers' }],
      };
    }
  }

  // ========== 化工密闭空间场景特定分析 ==========
  if (scenario === 'refinery') {
    // 空间网络概览
    if ((lowerInput.includes('空间') || lowerInput.includes('设备') || lowerInput.includes('罐') || lowerInput.includes('反应釜')) && (lowerInput.includes('概览') || lowerInput.includes('分布') || lowerInput.includes('网络') || lowerInput.includes('情况'))) {
      const tankZones = fractures.filter(f => f.name.includes('罐') || f.name.includes('E-') || f.name.includes('人孔'));
      const reactorZones = fractures.filter(f => f.name.includes('反应釜'));
      const manwayZones = fractures.filter(f => f.name.includes('人孔') || f.name.includes('入口') || f.name.includes('出口'));
      const deadZones = fractures.filter(f => f.name.includes('底') || f.name.includes('盲端') || f.name.includes('死角'));
      const thinRisk = fractures.filter(f => f.sensorReading.rock_strength_mpa > 3);
      const h2sRisk = fractures.filter(f => f.sensorReading.h2s_ppm > 50);
      const o2Risk = fractures.filter(f => f.sensorReading.stress_mpa < 19.5);
      return {
        message: `## 化工密闭空间内部网络概览\n\n微型蛇形/履带机器人从人孔进入储罐和反应釜局部切片，共 **${fractures.length}** 段空间/通道：\n\n| 区域 | 段数 | 说明 |\n|------|------|------|\n| 储罐内壁/罐底 | ${tankZones.length} | 液位线、罐底沉积、人孔附近 |\n| 反应釜内部 | ${reactorZones.length} | 内壁、搅拌轴周边、顶部气相区 |\n| 人孔/出入口 | ${manwayZones.length} | 机器人进入与撤出边界 |\n| 低洼/死角 | ${deadZones.length} | 残液、H₂S/VOC 聚集高风险区 |\n\n⚠️ **${h2sRisk.length}** 段 H₂S 超 50ppm，**${o2Risk.length}** 段 O₂ 低于 19.5%，**${thinRisk.length}** 段壁厚损失超 3%。`,
        actions: [{ type: 'fitAll' }, { type: 'clearMarkers' }],
      };
    }
    // 壁厚减薄分析
    if (lowerInput.includes('壁厚') || lowerInput.includes('减薄')) {
      const thinSorted = fractures.map(f => ({ f, thin: f.sensorReading.rock_strength_mpa, wt: f.sensorReading.fracture_aperture_um / 1000, mat: f.sensorReading.pore_pressure_mpa }))
        .sort((a,b) => b.thin - a.thin);
      const top = thinSorted.slice(0, 6);
      const danger = top.filter(x => x.thin > 3);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.thin.toFixed(1)}% | ${x.wt.toFixed(1)}mm | ${x.thin > 5 ? '🔴 严重' : x.thin > 3 ? '⚠️ 超标' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} 减薄=${x.thin.toFixed(1)}%`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `壁厚损失最严重: ${danger[0].f.id}` });
      }
      return {
        message: `## 密闭空间壁厚损失分析\n\n基于机器人超声测厚数据，对罐底、内壁和人孔附近做局部复核：\n\n| 区域 | 损失率 | 当前壁厚 | 状态 |\n|------|--------|---------|------|\n${rows}\n\n> 壁厚损失 >20% 需进一步适用性评估；当前面板以 3% 作为演示预警线，用于提示需要复测的局部点位。`,
        actions,
      };
    }
    // 腐蚀速率
    if (lowerInput.includes('腐蚀') || lowerInput.includes('速率')) {
      const corrSorted = fractures.map(f => ({ f, corr: f.sensorReading.permeability_md, scale: f.sensorReading.stress_sigma2 }))
        .sort((a,b) => b.corr - a.corr);
      const top = corrSorted.slice(0, 6);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.corr.toFixed(3)} mm/yr | ${x.scale.toFixed(2)}mm | ${x.corr > 0.3 ? '🔴 超标' : x.corr > 0.15 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (top.length > 0) actions.push({ type: 'flyTo', position: fractureCenter(top[0].f), region: `腐蚀最严重: ${top[0].f.id}` });
      return {
        message: `## 内壁腐蚀速率评估\n\n基于机器人超声测厚与局部腐蚀估算：\n\n| 区域 | 腐蚀速率 | 残留/沉积厚度 | 状态 |\n|------|---------|--------------|------|\n${rows}\n\n> 腐蚀速率 >0.3mm/yr 建议加密监测；罐底和液位线附近应优先复测。`,
        actions,
      };
    }
    // 氧气复核
    if (lowerInput.includes('o2') || lowerInput.includes('氧') || lowerInput.includes('缺氧')) {
      const creepSorted = fractures
        .map(f => ({ f, o2: f.sensorReading.stress_mpa, h2s: f.sensorReading.h2s_ppm }))
        .sort((a,b) => a.o2 - b.o2);
      const top = creepSorted.slice(0, 5);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.o2.toFixed(1)}% | ${x.h2s.toFixed(0)}ppm | ${x.o2 < 19.5 ? '🔴 缺氧复核' : x.o2 > 23.5 ? '⚠️ 富氧关注' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      const danger = top.filter(x => x.o2 < 19.5 || x.o2 > 23.5);
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} O₂=${x.o2.toFixed(1)}%`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `O₂异常: ${danger[0].f.id}` });
      }
      return {
        message: `## O₂ 复核\n\n| 区域 | O₂ | H₂S | 状态 |\n|------|----|-----|------|\n${rows}\n\n> 人员进入前 O₂ 通常需维持 19.5%-23.5%，异常区域必须先通风置换并复测。`,
        actions,
      };
    }
    // 声发射检测（裂纹）
    if (lowerInput.includes('声发射') || lowerInput.includes('裂纹') || lowerInput.includes('ae')) {
      const aeSorted = fractures.map(f => ({ f, ae: f.sensorReading.acoustic_emission_mv, co: f.sensorReading.co_ppm }))
        .sort((a,b) => b.ae - a.ae);
      const top = aeSorted.slice(0, 5);
      const danger = top.filter(x => x.ae > 2000);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.ae} mV | ${x.co}ppm | ${x.ae > 2000 ? '🔴 活动裂纹' : x.ae > 1000 ? '⚠️ 需复检' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} 声发射=${x.ae}mV`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `声发射异常: ${danger[0].f.id}` });
      }
      return {
        message: `## 内壁裂纹/异常声发射分析\n\n基于机器人声学与超声复核信号：\n\n| 区域 | 声发射幅值 | CO浓度 | 状态 |\n|------|----------|--------|------|\n${rows}\n\n> 声发射 >2000mV 表示需要复检，不直接等同裂纹定论。`,
        actions,
      };
    }
    // 泄漏检测
    if (lowerInput.includes('泄漏') || lowerInput.includes('可燃') || lowerInput.includes('gas')) {
      const leakSorted = fractures.map(f => ({ f, leak: f.sensorReading.ch4_pct, h2s: f.sensorReading.h2s_ppm }))
        .filter(x => x.leak > 0).sort((a,b) => b.leak - a.leak);
      const top = leakSorted.slice(0, 5);
      const danger = top.filter(x => x.leak > 20);
      const rows = top.map(x => `| ${x.f.id} (${x.f.name}) | ${x.leak.toFixed(1)}%LEL | ${x.h2s}ppm | ${x.leak > 20 ? '🔴 立即隔离' : x.leak > 10 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');
      const actions: SceneAction[] = [{ type: 'clearMarkers' }];
      if (danger.length > 0) {
        actions.push({ type: 'markPoints', points: danger.map(x => ({ position: fractureCenter(x.f), label: `${x.f.id} 泄漏=${x.leak.toFixed(1)}%LEL`, level: 'danger' as const })) });
        actions.push({ type: 'flyTo', position: fractureCenter(danger[0].f), region: `泄漏点: ${danger[0].f.id}` });
      }
      return {
        message: `## 可燃气体泄漏检测\n\n基于催化燃烧传感器+H₂S电化学传感器：\n\n| 通道 | 泄漏浓度 | H₂S | 状态 |\n|------|---------|-----|------|\n${rows}\n\n> 可燃气体 >20%LEL 立即隔离\n> H₂S >50ppm 进入酸性服务区 (NACE MR0105)`,
        actions,
      };
    }
  }
  // ========== 兜底 ==========
  // 管线场景兜底
  if (scenario === 'pipeline') {
    return {
      message: `我已收到您的指令："${input}"\n\n当前小口径管道共 **${fractures.length}** 段，可用指令：\n- 管段分布概览\n- 泄漏/壁厚检测\n- 腐蚀速率分析\n- 找出危险管段\n- H₂S 监测\n- 可通行性复核\n\n请问还需要分析什么？`,
    };
  }
  // 核反应堆场景兜底
  if (scenario === 'nuclear') {
    return {
      message: `我已收到您的指令："${input}"\n\n当前核反应堆管道共 **${fractures.length}** 段，可用指令：\n- 管道网络概览\n- 剂量率巡测\n- 疲劳累积评估\n- 找出辐射热点\n- FAC腐蚀监测\n- 冷却剂活度\n- 振动状态评估\n\n请问还需要分析什么？`,
    };
  }
  // 化工密闭空间场景兜底
  if (scenario === 'refinery') {
    return {
      message: `我已收到您的指令："${input}"\n\n当前化工密闭空间共 **${fractures.length}** 段，可用指令：\n- 空间概览\n- H₂S 监测\n- 可燃气体检测\n- O₂ 复核\n- 壁厚减薄分析\n- 找出最危险区域\n\n请问还需要分析什么？`,
    };
  }
  if (scenario === 'underground') {
    return {
      message: `我已收到您的指令："${input}"\n\n当前地下暗流通道网络共 **${fractures.length}** 段，可用指令：\n- 暗流网络概览\n- 渗透率分析\n- 水压异常\n- 地温梯度\n- 水质异常\n- 狭窄瓶颈定位\n- 找出最危险的点\n\n请问还需要分析什么？`,
    };
  }
  return {
    message: `我已收到您的指令："${input}"\n\n当前场景共 **${fractures.length}** 条裂缝，可通过以下指令分析：\n- 裂缝分布概览\n- 瓦斯浓度分析\n- 应力场分析\n- 渗透率评估\n- 温度场分析\n- 突水预警\n- 找出最危险的点\n- F-xxx 风险评估（如 F-003风险评估）\n\n请问还需要分析什么？`,
  };
}

/** 分析单条裂缝的综合风险 */
function analyzeFracture(f: Fracture, gasThreshold: number): AIResponse {
  const s = f.sensorReading;
  const risks: string[] = [];
  const markers: { position: [number, number, number]; label: string; level: 'danger' | 'warning' | 'info' }[] = [];

  if (s.ch4_pct >= gasThreshold) {
    risks.push(`- **CH₄浓度**: ${s.ch4_pct.toFixed(2)}% ${s.ch4_pct >= 1.5 ? '🔴 超标' : '⚠️ 超标'}`);
    markers.push({
      position: fractureCenter(f),
      label: `${f.id} CH₄=${s.ch4_pct.toFixed(1)}%`,
      level: s.ch4_pct >= 1.5 ? 'danger' : 'warning',
    });
  }
  if (s.temperature_c > 38) {
    risks.push(`- **温度**: ${s.temperature_c.toFixed(1)}°C ⚠️ 异常偏高`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 温度=${s.temperature_c.toFixed(0)}°C`, level: 'warning' });
  }
  if (s.water_pressure_mpa > 5) {
    risks.push(`- **水压**: ${s.water_pressure_mpa.toFixed(1)} MPa 🔴 接近临界值`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 水压=${s.water_pressure_mpa.toFixed(1)}MPa`, level: 'danger' });
  }
  if (s.microseismic_count > 15) {
    risks.push(`- **微震**: ${s.microseismic_count} 次/h ⚠️ 超过警戒线`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 微震=${s.microseismic_count}/h`, level: 'warning' });
  }
  if (s.stress_mpa > 12) {
    risks.push(`- **应力**: σ₁=${s.stress_mpa.toFixed(1)} MPa ⚠️ 应力集中`);
    markers.push({ position: fractureCenter(f), label: `${f.id} σ₁=${s.stress_mpa.toFixed(0)}MPa`, level: 'warning' });
  }

  const overallRisk = risks.length >= 3 ? '🔴 **高风险**' : risks.length >= 1 ? '⚠️ **中风险**' : '🟢 **低风险**';

  const actions: SceneAction[] = [
    { type: 'clearMarkers' },
    { type: 'selectFracture', fractureId: f.id },
  ];
  if (markers.length > 0) {
    actions.push({ type: 'markPoints', points: markers });
  }

  return {
    message: `## ${f.id} (${f.name}) 风险评估\n\n已自动选中该裂缝并展开详情。\n\n### 基础参数\n- 类型: ${f.type === 'main' ? '主裂缝' : '分支裂缝'}\n- 长度: ${f.length.toFixed(1)}m\n- 开度: ${f.aperture_um.toFixed(0)}µm\n- 倾角: ${f.dip_angle.toFixed(1)}°\n- 连通性: ${f.connectivity.toFixed(2)}\n- 渗透率: ${s.permeability_md.toFixed(2)} mD\n\n### 风险因素\n${risks.length > 0 ? risks.join('\n') : '- 未检测到明显异常'}\n\n### 综合评估\n该裂缝为${overallRisk}区域。`,
    actions,
  };
}

/**
 * 分析裂缝数据找出最危险的点
 */
function findDangerousPoints(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  if (!sceneContext || sceneContext.fractures.length === 0) {
    const semantics = getSceneSemantics(sceneContext?.scenario ?? 'coal');
    return {
      message: `当前场景尚未加载${semantics.networkLabel}数据。`,
    };
  }

  const { fractures, scenario, gasThreshold } = sceneContext;
  const semantics = getSceneSemantics(scenario);
  const lowerInput = input.toLowerCase();

  const allNodes = fractures.flatMap((f) =>
    f.nodes.map((n) => {
      const ch4 = n.sensors.ch4_pct;
      const temp = n.sensors.temperature_c;
      const stress = n.sensors.stress_mpa;
      const micro = n.sensors.microseismic_count;
      const water = n.sensors.water_pressure_mpa;
      const h2s = n.sensors.h2s_ppm;
      const perm = n.sensors.permeability_md;

      let score = 0;
      if (scenario === 'coal') {
        score = ch4 * 25 + (ch4 > gasThreshold ? 30 : 0) + (temp > 38 ? 10 : 0) + (micro > 15 ? 20 : 0);
      } else if (scenario === 'gold') {
        score = stress * 3 + (micro > 15 ? 30 : 0) + (temp > 40 ? 10 : 0);
      } else if (scenario === 'pipeline') {
        // 管线场景：泄漏 + H₂S + 腐蚀 + 屈服利用率
        score = ch4 * 2 + h2s * 0.1 + perm * 100 + (n.sensors.stress_sigma1 > 72 ? 25 : 0) + (n.sensors.rock_strength_mpa > 40 ? 20 : 0);
      } else if (scenario === 'nuclear') {
        // 核反应堆：剂量率 + 疲劳 + FAC + 冷却剂活度 + 振动
        score = ch4 * 1.5 + (water > 60 ? 25 : 0) + (h2s > 5 ? 30 : 0) + (perm > 0.1 ? 15 : 0) + (micro > 7 ? 15 : 0);
      } else if (scenario === 'refinery') {
        // 化工密闭空间：H2S + O2 + LEL + 壁厚损失 + 声发射 + 腐蚀
        const wallLoss = n.sensors.rock_strength_mpa;
        const creep = n.sensors.water_saturation_pct * 100;
        const ae = n.sensors.acoustic_emission_mv;
        const scale = n.sensors.stress_sigma2;
        score = wallLoss * 8 + (creep > 8000 ? 25 : 0) + (ae > 2000 ? 30 : 0) + (scale > 3 ? 15 : 0) + ch4 * 1.5;
      } else if (scenario === 'underground') {
        score = perm * 0.01 + (perm > 5000 ? 35 : 0) + (water > 8 ? 20 : 0) + (temp > 90 ? 20 : 0) + (h2s > 10 ? 10 : 0);
      } else {
        score = perm * 5 + (water > 5 ? 20 : 0);
      }

      return {
        position: n.position,
        fractureId: f.id,
        fractureName: f.name,
        ch4, temp, stress, micro, water, h2s, perm,
        score,
      };
    })
  );

  const sorted = allNodes.sort((a, b) => b.score - a.score);
  const requestedTop = lowerInput.includes('top5') || lowerInput.includes('top 5') || lowerInput.includes('前5') || lowerInput.includes('五个') || lowerInput.includes('5个')
    ? 5
    : 3;
  const top = sorted.filter((x) => x.score > 0).slice(0, requestedTop);

  if (top.length === 0) {
    return {
      message: `当前场景未检测到异常数据。`,
    };
  }

  // 场景特定因子描述
  const points = top.map((n, i) => {
    const factors: string[] = [];
    if (scenario === 'pipeline') {
      if (n.ch4 > 20) factors.push(`泄漏=${n.ch4.toFixed(1)}%LEL`);
      if (n.h2s > 50) factors.push(`H₂S=${n.h2s.toFixed(0)}ppm`);
      if (n.perm > 0.25) factors.push(`腐蚀=${n.perm.toFixed(2)}mm/yr`);
    } else if (scenario === 'nuclear') {
      if (n.ch4 > 25) factors.push(`剂量率=${n.ch4.toFixed(1)}mSv/h`);
      if (n.water > 60) factors.push(`疲劳=${(n.water).toFixed(0)}%`);
      if (n.h2s > 5) factors.push(`活度=${n.h2s.toFixed(1)}Bq/mL`);
      if (n.perm > 0.1) factors.push(`FAC=${n.perm.toFixed(2)}mm/yr`);
      if (n.micro > 7) factors.push(`振动=${n.micro.toFixed(1)}mm/s`);
    } else if (scenario === 'refinery') {
      const wallLoss = fractures.find(f=>f.id===n.fractureId)?.nodes.find(nn=>nn.position===n.position)?.sensors.rock_strength_mpa ?? 0;
      const ae = fractures.find(f=>f.id===n.fractureId)?.nodes.find(nn=>nn.position===n.position)?.sensors.acoustic_emission_mv ?? 0;
      const scale = fractures.find(f=>f.id===n.fractureId)?.nodes.find(nn=>nn.position===n.position)?.sensors.stress_sigma2 ?? 0;
      if (n.ch4 > 10) factors.push(`泄漏=${n.ch4.toFixed(1)}%LEL`);
      if (wallLoss > 3) factors.push(`壁厚减薄=${wallLoss.toFixed(1)}%`);
      if (ae > 2000) factors.push(`声发射=${ae.toFixed(0)}mV`);
      if (scale > 3) factors.push(`结垢=${scale.toFixed(1)}mm`);
      if (n.h2s > 50) factors.push(`H₂S=${n.h2s.toFixed(0)}ppm`);
    } else if (scenario === 'underground') {
      if (n.perm > 5000) factors.push(`渗透率=${n.perm.toFixed(0)}mD`);
      if (n.water > 8) factors.push(`水压=${n.water.toFixed(1)}MPa`);
      if (n.temp > 90) factors.push(`地温=${n.temp.toFixed(0)}°C`);
      if (n.h2s > 10) factors.push(`H₂S=${n.h2s.toFixed(1)}ppm`);
    } else {
      if (n.ch4 > gasThreshold) factors.push(`CH₄=${n.ch4.toFixed(1)}%`);
      if (n.temp > 38) factors.push(`温度=${n.temp.toFixed(0)}°C`);
      if (n.micro > 15) factors.push(`微震=${n.micro}次/h`);
      if (n.water > 5) factors.push(`水压=${n.water.toFixed(1)}MPa`);
    }

    return {
      position: n.position as [number, number, number],
      label: `${n.fractureId} ${factors.join(' ')}`,
      level: (i === 0 ? 'danger' : 'warning') as 'danger' | 'warning',
    };
  });

  // 场景特定表格
  const tableRows = top
    .map((n, i) => {
      const level = i === 0 ? '🔴 危险' : '⚠️ 警告';
      if (scenario === 'pipeline') {
        return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | 泄漏=${n.ch4.toFixed(1)}%LEL, H₂S=${n.h2s.toFixed(0)}ppm, 腐蚀=${n.perm.toFixed(2)}mm/yr | ${level} |`;
      }
      if (scenario === 'nuclear') {
        return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | 剂量率=${n.ch4.toFixed(1)}mSv/h, 疲劳=${n.water.toFixed(0)}%, 活度=${n.h2s.toFixed(1)}Bq/mL | ${level} |`;
      }
      if (scenario === 'refinery') {
        return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | 泄漏=${n.ch4.toFixed(1)}%LEL, H₂S=${n.h2s.toFixed(0)}ppm, 温度=${n.temp.toFixed(0)}°C | ${level} |`;
      }
      if (scenario === 'underground') {
        return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | 渗透率=${n.perm.toFixed(0)}mD, 水压=${n.water.toFixed(1)}MPa, 地温=${n.temp.toFixed(0)}°C | ${level} |`;
      }
      return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | CH₄=${n.ch4}%, 温度=${n.temp.toFixed(0)}°C, 微震=${n.micro}/h | ${level} |`;
    })
    .join('\n');

  const title = scenario === 'pipeline' ? '危险管段分析' : scenario === 'nuclear' ? '辐射热点分析' : scenario === 'refinery' ? '设备内检异常分析' : scenario === 'underground' ? '暗流通道异常分析' : '最危险区域分析';

  return {
    message: `## ${title}\n\n根据实时传感器数据综合评分，标记了 ${top.length} 个高风险点位：\n\n| 编号 | ${semantics.objectLabel} | 关键指标 | 等级 |\n|------|---------|---------|------|\n${tableRows}\n\n已自动飞行到最危险区域（${top[0].fractureId}），脉冲标记已标注在3D场景中。`,
    actions: [
      { type: 'clearMarkers' },
      { type: 'markPoints', points },
      { type: 'flyTo', position: top[0].position as [number, number, number], region: `${title}: ${top[0].fractureId}` },
    ],
  };
}

export const quickCommands = [
  { label: '裂缝分布概览', command: '裂缝网络分布情况' },
  { label: '瓦斯浓度分析', command: '分析当前瓦斯浓度' },
  { label: '应力场分析', command: '分析地应力场分布' },
  { label: '找出最危险的点', command: '找出最危险的点并标记' },
  { label: '渗透率评估', command: '渗透率评估分析' },
  { label: '突水预警', command: '突水风险预警' },
  { label: '温度场分析', command: '分析温度场分布' },
];

// ==================== 场景特定快捷指令 ====================

const QUICK_COMMANDS: Record<string, QuickCommand[]> = {
  // 煤矿瓦斯场景
  fracture: [
    { label: '巷道概览', command: '煤矿巷道瓦斯网络概览' },
    { label: 'CH4巡检', command: '分析当前CH4浓度' },
    { label: 'CO巡检', command: '分析当前CO浓度' },
    { label: '找出最危险的点', command: '找出最危险的点并标记' },
    { label: '通风盲区', command: '分析通风盲区和Mesh覆盖' },
    { label: 'O2复核', command: '分析当前O2浓度' },
    { label: '温度分析', command: '分析温度场分布' },
  ],
  // 金矿安全场景
  gold: [
    { label: '裂缝概览', command: '金矿裂缝网络概览' },
    { label: '微震分析', command: '分析微震活动分布' },
    { label: '应力集中', command: '分析地应力场分布' },
    { label: '找出岩爆风险', command: '找出最危险的点并标记' },
    { label: '岩温复核', command: '分析温度场分布' },
    { label: '裂缝连通性', command: '分析裂缝连通性' },
    { label: '岩爆预测', command: '岩爆风险预测' },
  ],
  // 油气储层场景
  oil: [
    { label: '储层概览', command: '油气储层裂缝网络概览' },
    { label: '孔压分析', command: '分析孔隙压力分布' },
    { label: '渗透率评估', command: '渗透率评估分析' },
    { label: '找出高风险区', command: '找出最危险的点并标记' },
    { label: '含油饱和度', command: '分析含油饱和度分布' },
    { label: '地层温度', command: '分析温度场分布' },
    { label: '产能潜力', command: '评估储层产能潜力' },
  ],
  // 管线场景
  pipeline: [
    { label: '管段概览', command: '小口径管道分布情况概览' },
    { label: '壁厚评估', command: '管道壁厚损失评估' },
    { label: '腐蚀评估', command: '分析管道腐蚀速率' },
    { label: '找出危险管段', command: '找出最危险的管段并标记' },
    { label: 'H₂S监测', command: '硫化氢浓度监测分析' },
    { label: '可通行性', command: '分析管道可通行性' },
    { label: '泄漏检测', command: '检测管道泄漏点' },
  ],
  // 核反应堆场景
  nuclear: [
    { label: '管道网络概览', command: '核反应堆管道网络概览' },
    { label: '剂量率巡测', command: '分析辐射剂量率分布' },
    { label: '疲劳累积评估', command: '管道疲劳累积损伤评估' },
    { label: '找出辐射热点', command: '找出辐射热点并标记' },
    { label: 'FAC腐蚀监测', command: 'FAC流动加速腐蚀监测' },
    { label: '冷却剂活度', command: '冷却剂放射性活度分析' },
    { label: '振动状态评估', command: '管道振动状态评估' },
  ],
  // 化工密闭空间场景
  refinery: [
    { label: '空间概览', command: '化工密闭空间概览' },
    { label: 'H₂S监测', command: '分析H2S浓度分布' },
    { label: 'O₂复核', command: '分析O2浓度分布' },
    { label: '找出最危险区域', command: '找出最危险的密闭空间并标记' },
    { label: '壁厚减薄', command: '分析壁厚减薄情况' },
    { label: '可燃气体', command: '可燃气体泄漏检测分析' },
    { label: '温度复核', command: '分析空间温度分布' },
  ],
  // 地下暗流场景
  underground: [
    { label: '暗流网络概览', command: '地下暗流通道网络概览' },
    { label: '流速分析', command: '分析通道水流速分布' },
    { label: '渗透率评估', command: '评估岩层渗透率分布' },
    { label: '水质异常', command: '分析矿化度和水质异常区域' },
    { label: '狭窄瓶颈定位', command: '找出最狭窄的通道瓶颈并标记' },
    { label: '溶洞体积估算', command: '估算溶洞腔体体积' },
    { label: '地温梯度', command: '地温梯度异常分析' },
  ],
};

export function getQuickCommands(scenario: string, locale: Locale = 'zh-CN'): QuickCommand[] {
  const commands =
    scenario === 'pipeline' ? QUICK_COMMANDS.pipeline
      : scenario === 'nuclear' ? QUICK_COMMANDS.nuclear
        : scenario === 'refinery' ? QUICK_COMMANDS.refinery
          : scenario === 'underground' ? QUICK_COMMANDS.underground
            : scenario === 'gold' ? QUICK_COMMANDS.gold
              : scenario === 'oil' ? QUICK_COMMANDS.oil
                : QUICK_COMMANDS.fracture;

  if (locale === 'zh-CN') return commands;

  const labelMap: Record<string, string[]> = {
    fracture: ['Roadway Overview', 'CH4 Review', 'CO Review', 'Find Dangerous Zones', 'Ventilation Blind Spots', 'O2 Review', 'Temperature Review'],
    gold: ['Fracture Overview', 'Microseismic Review', 'Stress Concentration', 'Find Burst Risks', 'Rock-Temperature Review', 'Connectivity Review', 'Burst Forecast'],
    oil: ['Reservoir Overview', 'Pore-Pressure Review', 'Permeability Review', 'Find Risk Zones', 'Oil-Saturation Review', 'Formation-Temperature Review', 'Productivity Potential'],
    pipeline: ['Pipe Overview', 'Wall-Loss Review', 'Corrosion Review', 'Find Risk Segments', 'H2S Review', 'Passability Review', 'Leak Review'],
    nuclear: ['Piping Overview', 'Dose-Rate Survey', 'Fatigue Review', 'Find Radiation Hotspots', 'FAC Monitoring', 'Coolant Activity', 'Vibration Review'],
    refinery: ['Confined-Space Overview', 'H2S Review', 'O2 Review', 'Find Dangerous Zones', 'Wall-Loss Review', 'Flammable Gas Review', 'Temperature Review'],
    underground: ['Channel Overview', 'Flow Review', 'Permeability Review', 'Water-Quality Exceptions', 'Find Bottlenecks', 'Cavity Volume Estimate', 'Geothermal Gradient'],
  };

  const key =
    scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground' || scenario === 'gold' || scenario === 'oil'
      ? scenario
      : 'fracture';

  return commands.map((command, index) => ({
    ...command,
    label: labelMap[key][index] ?? command.label,
  }));
}

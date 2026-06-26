# HIVE 场景包与客户定制展示接入规范

> **文档级别**：强制规范（Mandatory）
>
> **代码真源**：
> - 场景类型：`src/types/index.ts`
> - 场景语义：`src/lib/sceneSemantics.ts`
> - 场景数据集：`src/domain/sceneDataset.ts`
> - 原始/Mock 数据：`src/data/*DataGenerator.ts`
> - API 容错：`src/api/normalizers.ts`
> - 机器人任务翻译：`src/lib/taskLocale.ts`
> - 机器人遥测语义：`src/lib/robotTelemetryCopy.ts`
> - 图层/真实面貌文案：`src/lib/sceneControlCopy.ts`
> - 测量工具语义：`src/lib/sceneMeasureConfig.ts`
> - AI 场景提示：`src/api/aiApi.ts`、`src/lib/mockAI.ts`
> - 浏览器验收：`scripts/ui-regression.mjs`

---

## 1. 目标

HIVE 新增客户或行业场景时，必须按“场景包（Scene Pack）+ 客户展示包（Customer Presentation Pack）”接入。

目标不是把前端组件复制一套，也不是在各个面板里手填数字，而是：

1. 先接入原始观测数据或 mock 原始数据。
2. 经由 normalizer 清洗成统一领域对象。
3. 由 `sceneDataset` 和领域函数计算统计、趋势、告警、可信度、覆盖率、导出状态。
4. 由场景语义配置驱动 UI 文案、指标、阈值、图层、右栏、工具、AI 和导出。
5. 由客户展示包决定“重点展示什么”，但不得绕过数据真实性和安全边界。

---

## 2. 接入分层

### 2.1 场景包 Scene Pack

场景包描述“这个行业/工况是什么”。例如：煤矿裂缝、金矿采区、油气储层、油气管线、核反应堆管道、炼化设备、地下暗流。

必须包含：

| 类别 | 必填内容 | 代码位置 |
| --- | --- | --- |
| 场景 ID | `ScenarioType` 和必要的 `DataSourceType` | `src/types/index.ts` |
| 原始数据源 | mock generator 或 live API adapter | `src/data/*` / `src/api/*` |
| 几何对象 | 主对象、路径、节点、机器人位置 | `Fracture` / `FractureNode` / `Robot` |
| 主指标 | primary metric、单位、阈值、范围 | `sceneSemantics.ts` |
| 辅助指标 | 温度、压力、腐蚀、剂量、渗透率等 | `sceneSemantics.ts` |
| 图层语义 | 结构层、网络层、点云、机器人、POI | `sceneControlCopy.ts` / `LayerToggle` |
| 右栏详情 | 对象名称、指标卡、风险阈值、节点列表 | `FractureDetailPanel.tsx` |
| 机器人任务 | 任务词表、英文翻译、机型约束 | `robotDataGenerator.ts` / `taskLocale.ts` |
| AI 语义 | prompt、quick commands、mock AI 分析分支 | `aiApi.ts` / `mockAI.ts` |
| 导出语义 | 报告对象、受众、CSV/PDF/LAS/OBJ 描述 | `sceneSemantics.ts` / export modules |
| 回归测试 | 单测 + UI regression 场景矩阵 | `*.test.ts` / `scripts/ui-regression.mjs` |

### 2.2 客户展示包 Customer Presentation Pack

客户展示包描述“这个客户演示时重点看什么”。它不得改变底层数据事实，只能改变优先级、默认视图、展示密度和话术。

允许配置：

| 类别 | 可配置内容 | 不允许做 |
| --- | --- | --- |
| 首屏重点 | 默认场景、默认视角、默认打开的 panel | 不允许隐藏安全告警 |
| KPI 优先级 | 哪些指标排在前面，如剂量率/渗透率/泄漏/腐蚀 | 不允许修改指标计算公式制造好看数字 |
| 阈值预设 | 客户标准阈值、法规阈值、演示阈值标签 | 不允许把危险阈值伪装成安全阈值 |
| 角色视图 | 管理、安全、工程、交付角色默认 tab | 不允许取消真值边界/AI 推断说明 |
| 导出模板 | 报告标题、客户名、项目名、交付格式默认值 | 不允许删掉证据边界和合规说明 |
| AI 话术 | 行业术语、客户内部叫法、快捷指令排序 | 不允许让 AI 输出安全结论而无证据来源 |

---

## 3. 统一数据管线

任何新场景都必须走以下链路：

```text
raw observation / mock raw data
  -> normalizer
  -> canonical domain objects
  -> sceneDataset
  -> derived summaries
  -> UI panels / AI context / export packages
```

### 3.1 原始数据最小集合

新场景至少提供：

| 数据 | 最小字段 |
| --- | --- |
| 结构/通道/路径 | `id`, `name`, `type`, `path`, `nodes` |
| 节点 | `id`, `position`, `timestamp`, `robotId`, `sensors` |
| 传感器 | 至少一个主指标、温度类指标、一个辅助指标 |
| 机器人 | `id`, `position`, `status`, `battery`, `meshRole`, `meshConnected`, `task`, `sensors` |
| 告警 | `id`, `level`, `type`, `title`, `description`, `robotId`, `position`, `timestamp`, `acknowledged` |

### 3.2 禁止项

- 禁止面板直接维护“最终展示数字”作为主真源。
- 禁止一个组件自己生成一套和 `sceneDataset` 不一致的 mock 汇总。
- 禁止为了演示效果改 UI 数字而不改原始数据。
- 禁止新增场景只改中文，不补英文。
- 禁止新增场景不补浏览器回归。

---

## 4. 场景包字段清单

新增场景时，产品/研发需要填写这份表。

```ts
interface HiveScenePackSpec {
  id: string;
  dataSource: string;
  displayNameZh: string;
  displayNameEn: string;
  domain: string;
  customerUseCases: string[];
  primaryObject: {
    zh: string;
    en: string;
    geometryKind: 'network' | 'pipe' | 'channel' | 'surface' | 'equipment';
  };
  metrics: {
    primary: SceneMetricSpec;
    temperature: SceneMetricSpec;
    aux: SceneMetricSpec;
    optional: SceneMetricSpec[];
  };
  thresholds: {
    default: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    safetyMeaning: string;
    source: 'regulation' | 'customer-standard' | 'engineering-default' | 'demo';
  };
  layers: {
    structure?: string;
    network: string;
    pointCloud: boolean;
    robots: boolean;
    poi: boolean;
  };
  robots: {
    allowedModels: string[];
    taskVocabularyZh: string[];
    taskVocabularyEn: string[];
    telemetryMapping: {
      primary: string;
      temperature: string;
      aux: string;
    };
  };
  ai: {
    role: string;
    quickCommandsZh: string[];
    quickCommandsEn: string[];
    forbiddenClaims: string[];
  };
  export: {
    reportAudience: string;
    objectDescription: string;
    sensorMatrixDescription: string;
    defaultFormats: ('pdf' | 'csv' | 'las' | 'obj')[];
  };
}
```

```ts
interface SceneMetricSpec {
  key: string;
  labelZh: string;
  labelEn: string;
  unit: string;
  normalRange: [number, number];
  warningThreshold?: number;
  precision: number;
  sourceFieldAliases: string[];
}
```

---

## 5. 客户展示包字段清单

客户展示包用于“同一个场景，不同客户演示重点不同”。

```ts
interface HiveCustomerPresentationPack {
  customerId: string;
  customerName: string;
  sceneId: string;
  projectName: string;
  defaultLocale: 'zh-CN' | 'en-US';
  defaultRole: 'manager' | 'safety' | 'engineer' | 'timeline';
  firstViewport: {
    cameraPreset: 'overview' | 'risk-first' | 'robot-first' | 'handover-first';
    highlightedMetrics: string[];
    defaultOpenPanels: string[];
  };
  kpiPriority: string[];
  thresholdOverrides?: {
    metricKey: string;
    value: number;
    label: string;
    reason: string;
    source: 'customer-standard' | 'regulation' | 'demo';
  }[];
  exportDefaults: {
    title: string;
    includeAIInferred: boolean;
    preferredFormats: ('pdf' | 'csv' | 'las' | 'obj')[];
  };
  aiTone: {
    terminologyOverrides: Record<string, string>;
    quickCommandPriority: string[];
  };
}
```

客户展示包可以改变“先看什么”，不能改变“事实是什么”。

---

## 6. 新场景接入步骤

### Step 1: 定义类型

修改：

- `src/types/index.ts`
- `src/store/useSceneStore.ts`
- `src/components/layout/ScenarioSelector.tsx`
- `src/lib/scenarioSelectorCopy.ts`
- `src/App.tsx` 的 dev bootstrap 场景白名单

验收：

- 场景能出现在选择器。
- `?dev-scenario=<new-scene>` 能启动对应场景。

### Step 2: 接入原始数据

新增或修改：

- `src/data/<scene>DataGenerator.ts`
- `src/data/robotDataGenerator.ts`
- `src/data/alertDataGenerator.ts`
- `src/domain/sceneDataset.ts`

验收：

- `buildSceneDataset(newDataSource, newScenario)` 返回结构、机器人、告警、summary。
- `summary.scene.totalNodes === all nodes length`。
- `summary.robotFleet.total === robots.length`。
- `summary.alerts.total === alerts.length`。

### Step 3: 接入语义

修改：

- `src/lib/sceneSemantics.ts`
- `src/lib/sceneControlCopy.ts`
- `src/lib/robotTelemetryCopy.ts`
- `src/lib/sceneMeasureConfig.ts`
- `src/lib/taskLocale.ts`

验收：

- 系统状态、趋势、阈值、图层、机器人卡、测量工具没有串场术语。
- 中英文都可用。

### Step 4: 接入详情面板

修改：

- `src/components/control-panel/FractureDetailPanel.tsx`
- 如确有必要，新增专用 detail schema，但优先复用现有通用 detail panel。

验收：

- 右侧空态标题和详情标题符合场景。
- 选中机器人、节点、路径都能展示对应信息。
- 指标单位、阈值、风险色符合语义配置。

### Step 5: 接入 AI 与导出

修改：

- `src/api/aiApi.ts`
- `src/lib/mockAI.ts`
- `src/api/llmTools.ts`
- `src/lib/pdfExport.ts`
- `src/lib/exportCSV.ts`

验收：

- AI 不使用旧场景术语。
- 导出说明包含新场景对象、指标、证据边界。
- AI 推断仍受审计、撤销、人工复核规则约束。

### Step 6: 补测试

必须新增或扩展：

- `src/domain/sceneDataset.test.ts`
- `src/lib/sceneSemantics.test.ts`
- `src/data/robotDataGenerator.scenario.test.ts`
- `src/data/alertDataGenerator.scenario.test.ts`
- `src/lib/taskLocale.test.ts`
- `scripts/ui-regression.mjs`

验收命令：

```bash
npm test
npm run lint
npm run build:check
HIVE_UI_BASE_URL=http://127.0.0.1:5177/ node scripts/ui-regression.mjs
```

---

## 7. 客户定制展示步骤

客户只想改展示重点时，不应新增场景。

优先顺序：

1. 复用已有场景。
2. 写客户展示包，配置默认角色、重点 KPI、默认视角、导出标题。
3. 如果客户指标字段不同，先扩展 normalizer aliases，不直接改 UI。
4. 如果客户指标含义不同，才新增场景包。

判断标准：

| 情况 | 做法 |
| --- | --- |
| 同样是管线，只是客户想重点看腐蚀 | 客户展示包 |
| 同样是核场景，只是客户阈值不同 | 客户展示包 + 阈值 override |
| 传感器字段名不同但含义一样 | normalizer alias |
| 对象、指标、风险逻辑都不同 | 新场景包 |

---

## 8. 验收红线

新增场景或客户包不得出现以下问题：

- 左侧趋势显示旧场景区域名。
- 图层显示不属于当前行业的结构名称。
- 机器人任务仍是旧场景任务。
- 右栏对象标题与当前场景不一致。
- 英文切换只改顶部，不改主体。
- Mock 数字无法从原始数据解释。
- 告警数量、节点数量、机器人数量不自洽。
- AI 说出未被数据或证据支持的安全结论。
- 导出文件不包含证据边界和 AI 推断说明。

---

## 9. 当前系统成熟度

当前 HIVE 已具备场景包化基础：

- 统一 mock/source-first 数据集已经存在。
- normalizer 已支持字段漂移、单位/枚举/缺省容错。
- 多数面板已读取 `sceneSemantics` 和 `sceneDataset`。
- P0/P1 浏览器回归已经覆盖语言、场景语义、3D 点选、重叠对象选择。

还没有完全插件化的部分：

- `ScenarioType` / `DataSourceType` 仍是 TypeScript union，需要代码修改。
- 部分 AI prompt、详情 panel、测量语义仍是 Record map，需要补场景 key。
- 客户展示包目前是规范，尚未落成独立运行时配置文件。

下一步如果要继续产品化，应把这些 Record map 收敛为 `sceneRegistry`，让新增场景更接近“填表式接入”。

---

## 10. 90 分以上验收标准

新增场景或客户展示包只有同时满足以下条件，才允许进入客户演示版本：

| 维度 | 验收标准 |
| --- | --- |
| 数据真实性 | 所有面板数字都能追溯到 raw/mock raw data、normalizer 或 `sceneDataset` 派生结果。 |
| 数字自洽 | 节点数、机器人数量、告警数量、覆盖率、可信度、导出就绪度之间不存在逻辑矛盾。 |
| 场景一致性 | 系统状态、趋势、图层、测量工具、右栏、机器人任务、AI、导出全部使用当前场景术语。 |
| 客户重点 | 客户能配置默认角色、重点 KPI、阈值来源、默认视角和导出模板。 |
| 安全边界 | AI 推断、插值、未知区、人工作业确认必须被明确标识，不能混成同一种“事实”。 |
| 国际化 | 中文和英文都必须覆盖主体 UI、工具浮层、空态、详情态、告警、导出文案。 |
| 交互可验收 | 3D 选中、重叠对象选择、确认/取消/重选/退出、场景切换、语言切换均有回归覆盖。 |
| 可扩展性 | 新字段优先通过 normalizer alias 和 metric spec 接入，不直接改组件硬编码。 |

最低验收命令：

```bash
npm test
npm run lint
npm run build:check
HIVE_UI_BASE_URL=http://127.0.0.1:5177/ node scripts/ui-regression.mjs
```

如果只修改文档，可以不跑 UI regression，但必须说明本次没有改动运行时代码。

---

## 11. 配置化实施路线

当前规范已经约束“怎么做”，下一步可以把它逐步做成运行时能力：

1. 新增 `src/registry/sceneRegistry.ts`，把 `sceneSemantics`、图层、测量、AI、导出、任务词表合并成单一 scene pack registry。
2. 新增 `src/registry/customerPresentationRegistry.ts`，承载客户展示包，支持不同客户默认 KPI、默认角色、默认视角和导出模板。
3. normalizer 增加 `metricAliases` 注册机制，让客户字段差异优先通过配置处理。
4. UI 面板只读取 registry 和 derived dataset，不再在组件内判断具体行业。
5. regression 脚本自动遍历 registry，确保每个场景/客户包都通过语言、语义、选择、工具和数据自洽检查。

这条路线的目标是：以后新增一个客户或行业，不是复制页面，而是补一份场景包/客户展示包，再由主控舱自动生成对应商业化面板。

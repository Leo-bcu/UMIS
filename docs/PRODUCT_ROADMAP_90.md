# HIVE 90 分国际化产品路线图

> **文档级别**：产品路线（Reference / Roadmap）
>
> **关联资料**：
> - [COMPETITIVE_RESEARCH.md](./COMPETITIVE_RESEARCH.md)
> - [UX_AUDIT_REPORT.md](./UX_AUDIT_REPORT.md)
> - [EXPORT_STANDARD.md](./EXPORT_STANDARD.md)
> - [AI_PROMPT_STANDARD.md](./AI_PROMPT_STANDARD.md)

---

## 一、目标

把 HIVE 从当前“工程 demo / 早期产品”提升为 90 分以上的国际化工业级产品。

HIVE 的方向不是重型数字孪生中台，而是：

> **未知/危险空间的 AI 安全认知与交付工作台。**

用户通过特种机器人、传感器、点云、轨迹和 AI 推理，快速判断：

- 哪些区域已探明？
- 哪些区域仍未知？
- 哪里风险最高？
- 风险证据是什么？
- AI 结论可信边界在哪里？
- 下一步应该复查什么？
- 如何导出给 CAD/GIS/点云/报告工具继续分析？

---

## 二、产品边界

### 必须坚持

- 以特种机器人、传感器、点云、轨迹为事实基础。
- AI 负责解释、筛选、定位、生成建议，但不能替代安全确认。
- 重分析交给 CAD/GIS/点云/工业系统，HIVE 做前置认知、证据整理、轻量交付。
- 所有结论必须能追溯到证据。
- 所有资料/方案文档必须进入 [docs/README.md](./README.md) 索引。

### 暂不进入

- 视频/图像逐帧缺陷识别。
- 完整矿山 FMS。
- 完整 CAD/BIM 编辑器。
- ERP/CMMS/库存/燃油/生产调度。
- 泛行业重型数字孪生平台。

---

## 三、竞品精华融合原则

| 竞品 | 取其精华 | 去其糟粕 / 不照抄 |
|------|----------|-------------------|
| Flyability Elios 3 | 探索覆盖、任务轨迹、POI/Finding、报告闭环、安全边界 | 不做飞控软件，不以视频为核心 |
| DroneDeploy | 证据链、时间线、问题 pin、远程共享、ROI 表达 | 不做施工影像管理平台 |
| NavVis IVION | 浏览器共享工作台、非专家可理解、角色化、source of truth | 不做完整 BIM/设施管理平台 |
| PIX4Dsurvey | CAD-ready 图层、导出预检、矢量化交付 | 不做 CAD 编辑器 |
| GroundHog Apps | 矿山商业面板、角色、任务、安全 KPI、快速部署语言 | 不做完整 FMS/ERP |

---

## 四、评分路径

| 阶段 | 目标分 | 目标状态 |
|------|--------|----------|
| 当前 | 48/100 | 工程 demo 能力强，但商业闭环不足 |
| Phase 1 | 65/100 | 可信安全认知 MVP |
| Phase 2 | 75/100 | 任务/风险/证据工作台 |
| Phase 3 | 83/100 | AI 成为主交互，并具备安全边界 |
| Phase 4 | 88/100 | CAD-ready 导出和报告成为付费壁垒 |
| Phase 5 | 90+/100 | 国际化工业级产品 |

---

## 五、模块复用扫描规则

每个新增模块开工前必须做一次 `Build / Buy / Open-source Scan`。

扫描输出必须记录：

1. 候选成熟库 / GitHub 项目 / 商业参考。
2. 许可证风险。
3. 与 React / Zustand / R3F / FastAPI 的兼容性。
4. 采用成本。
5. 自研成本。
6. 最终决策：采用、封装、参考、或自研。

默认倾向：

- 通用 UI / 表单 / 表格 / 图表 / 时间线：优先成熟库。
- 安全边界 / 证据语义 / HIVE 域模型：倾向自研，因为这是产品核心。
- CAD/LAS/报告导出：优先保留现有实现并补测试；复杂格式再评估成熟库。

---

## 六、阶段计划

### Phase 1：可信安全认知 MVP

目标：打掉“玩具感”，让 HIVE 的风险结论可追溯、可复查、可报告。

模块：

1. `Finding` 风险发现对象。
2. `Evidence Card` 证据卡片。
3. `Truth Boundary` 可信边界。
4. `Exploration Coverage` 探索覆盖。
5. 从 Finding 生成报告片段。

核心验收：

- 告警、AI 标记、人工标注都能进入 Finding。
- 每个 Finding 都能解释“为什么危险”。
- UI 明确区分实测、插值、AI 推断、未探明、人工确认。
- 用户能看到已探明/未探明/低置信区域。

### Phase 2：商业化角色面板

目标：让管理者、安全员、测绘工程师打开后各自知道下一步做什么。

模块：

1. Manager Dashboard。
2. Safety Queue。
3. Engineer Data Quality View。
4. Mission Timeline。
5. 角色化详情面板。

核心验收：

- 管理者能看到今日风险、覆盖率、未复查项、最近报告。
- 安全员能处理高危复查队列。
- 工程师能看到数据质量和导出准备度。

### Phase 3：AI 主交互与安全边界

目标：AI 从“聊天框”升级成“可审计的安全认知操作员”。

模块：

1. AI evidence citation。
2. AI action policy。
3. AI action audit log。
4. Undoable AI actions。
5. 安全回答模板。

核心验收：

- AI 每个风险结论都引用证据。
- AI 不允许直接宣称“安全”。
- AI 所有动作可撤销、可追踪。

### Phase 4：CAD-ready 导出与报告

目标：让 HIVE 成为重工具前的数据整理入口。

模块：

1. Export Wizard。
2. CAD/GIS layer schema。
3. Export preflight。
4. Export history。
5. Finding-based report package。

核心验收：

- 导出前能选择用途、范围、图层、是否包含 AI 推断。
- 导出物明确标注可信边界。
- 报告不是截图集合，而是证据链交付物。

### Phase 5：国际化工业产品打磨

目标：达到 90+ 分的国际化产品观感和可靠性。

模块：

1. i18n。
2. Role-based permissions。
3. Project / mission history。
4. Error states and empty states。
5. Performance budget。
6. Visual polish。
7. Security and compliance text。

核心验收：

- 中英文切换完整。
- 关键工作流有权限和审计。
- 大型场景性能可控。
- UI 不再像 demo 控制台，而像安全认知产品。

---

## 七、执行顺序

1. Phase 1 先做域模型和测试：Finding / Evidence / Truth Boundary。
2. 再做 UI：证据卡片、风险发现列表、覆盖层。
3. 再接 AI：AI 标记转 Finding、AI 引用证据。
4. 再接报告：Finding-based report。
5. Phase 1 验收后再进入 Phase 2。

---

## 八、当前第一实施计划

第一份可执行计划：

[2026-06-13-phase1-finding-evidence-plan.md](./superpowers/plans/2026-06-13-phase1-finding-evidence-plan.md)


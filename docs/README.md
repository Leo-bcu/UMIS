# HIVE 产品标准索引 (Product Standards Index)

> **本文件是所有产品标准、规范、强制规则的唯一入口。**
>
> 新增任何标准文档时，必须在此索引中登记。
> 禁止在 `docs/` 之外散落规范类文档。

---

## 一、强制规范 (Mandatory Standards)

> 违反这些规范 = PR 不予合并。代码实现与文档冲突时，以文档为准。

| # | 文档 | 主题 | 级别 | 代码真源 | 更新日期 |
|---|------|------|------|---------|---------|
| S1 | [COLOR_STANDARD.md](./COLOR_STANDARD.md) | 3D 渲染色彩标准 | 🔴 强制 | `src/lib/sceneColors.ts` | 2026-06-13 |
| S2 | [EXPORT_STANDARD.md](./EXPORT_STANDARD.md) | 数据导出合规标准 (LAS/OBJ/CSV/PDF) | 🔴 强制 | `src/lib/exportLAS.ts` `exportOBJ.ts` `exportCSV.ts` `pdfExport.ts` | 2026-06-13 |
| S3 | [../API_CONTRACT.md](../API_CONTRACT.md) | API 对接契约 (前后端数据接口) | 🔴 强制 | `src/api/` 目录全部文件 | 2026-06-12 |
| S4 | [AI_PROMPT_STANDARD.md](./AI_PROMPT_STANDARD.md) | AI Prompt 通用规则标准 (防幻觉/言出法随/场景配置) | 🔴 强制 | `src/api/aiApi.ts` `COMMON_*` 常量 + `SCENE_PROMPTS` | 2026-06-13 |
| S5 | [SCENE_PACK_STANDARD.md](./SCENE_PACK_STANDARD.md) | 场景包与客户定制展示接入规范 | 🔴 强制 | `src/lib/sceneSemantics.ts` `src/domain/sceneDataset.ts` `src/api/normalizers.ts` | 2026-06-15 |

### S1. 色彩标准摘要
- 四大色系: 身份色(管道/岩石/核设施工业标准色) → 数据色(turbo colormap) → 状态色(红绿灯) → 交互色(黄色)
- 禁止组件内硬编码色值，必须从 `sceneColors.ts` 引用
- 地下暗流通道可见性: 禁用 transmission / 必须 emissive≥0.2 / 岩体 opacity≤0.5

### S2. 导出标准摘要
- 四大格式: PDF(管理层) / LAS 1.4(测绘工程师/Trimble) / OBJ+MTL(3D建模/3D打印) / CSV(ERP/SCADA)
- LAS 遵循 ASPRS 1.4-R15, CSV 遵循 RFC 4180 (UTF-8 BOM)
- 系统定位: 数据采集+看盘工具，不替代 Trimble/AutoCAD，但必须无缝导出

---

## 二、设计参考 (Design References)

> 不强制但强烈推荐遵循的产品设计参考。

| # | 文档 | 主题 | 日期 |
|---|------|------|------|
| R1 | [UI_ITERATION_REPORT.md](./UI_ITERATION_REPORT.md) | UI 迭代分析报告 (对标 Cesium/Palantir/DJI) | 2026-06-12 |
| R2 | [DATA_FORMAT.md](./DATA_FORMAT.md) | 数据格式说明 (Mock/真实数据切换) | 2026-06-12 |
| R3 | [UX_AUDIT_REPORT.md](./UX_AUDIT_REPORT.md) | 全量 UX 审计报告 (3角色视角, 45项问题) | 2026-06-13 |
| R4 | [COMPETITIVE_RESEARCH.md](./COMPETITIVE_RESEARCH.md) | 同类产品与商业化面板资料库 (Flyability/DroneDeploy/NavVis/PIX4D/GroundHog) | 2026-06-13 |
| R5 | [PRODUCT_ROADMAP_90.md](./PRODUCT_ROADMAP_90.md) | 90分国际化产品路线图 (竞品融合/阶段计划/模块复用扫描规则) | 2026-06-13 |
| R6 | [MODULE_REUSE_SCAN.md](./MODULE_REUSE_SCAN.md) | 模块复用扫描记录 (Build/Buy/Open-source Scan) | 2026-06-13 |
| R7 | [COMPETITIVE_SCORECARD_2026.md](./COMPETITIVE_SCORECARD_2026.md) | 国际竞品对标评分卡 (10维度加权,基于2026-06全量实测) | 2026-06-16 |
| R8 | [REAL_MINE_ASSET_SOURCES.md](./REAL_MINE_ASSET_SOURCES.md) | 真实矿坑/矿道资产来源、授权与煤矿场景接入规则 | 2026-06-19 |

---

## 三、规格文档 (Specifications)

> 功能规格与架构设计文档。

| # | 文档 | 主题 | 日期 |
|---|------|------|------|
| P1 | [superpowers/specs/2026-06-12-fracture-digital-twin-v2-design.md](./superpowers/specs/2026-06-12-fracture-digital-twin-v2-design.md) | v2 数字孪生整体架构设计 | 2026-06-12 |
| P2 | [superpowers/specs/2026-06-14-hive-90-data-pipeline-design.md](./superpowers/specs/2026-06-14-hive-90-data-pipeline-design.md) | 90+ 升级设计：统一数据底座、接口容错扩展、场景语义与验收标准 | 2026-06-14 |

## 四、实施计划 (Implementation Plans)

| # | 文档 | 主题 | 日期 |
|---|------|------|------|
| I1 | [superpowers/plans/2026-06-13-phase1-finding-evidence-plan.md](./superpowers/plans/2026-06-13-phase1-finding-evidence-plan.md) | Phase 1 风险发现与证据链实施计划 | 2026-06-13 |
| I2 | [superpowers/plans/2026-06-14-a2-light-graphite-ui-plan.md](./superpowers/plans/2026-06-14-a2-light-graphite-ui-plan.md) | A2 Light Graphite UI 改造实施计划 | 2026-06-14 |
| I3 | [superpowers/plans/2026-06-14-hive-90-data-pipeline-plan.md](./superpowers/plans/2026-06-14-hive-90-data-pipeline-plan.md) | 90+ 数据底座与接口容错实施计划 | 2026-06-14 |
| I4 | [superpowers/plans/2026-06-15-hive-90-p0-readiness-plan.md](./superpowers/plans/2026-06-15-hive-90-p0-readiness-plan.md) | 90+ P0 演示可信度收口计划 | 2026-06-15 |

---

## 五、强制规则速查 (Quick Reference)

> 以下规则由本索引和各标准文档集中登记，便于 PR Review。

| 规则 | 出处 | 代码检查方式 |
|------|------|-------------|
| 3D 颜色禁止硬编码，必须引用 `sceneColors.ts` | S1 | grep `#[0-9A-Fa-f]{6}` in `src/components/scene/` |
| 管道/裂缝/河道必须图论连通 (0 漂浮段) | 本索引 + `src/domain/topologyAudit.ts` | `node scripts/run-node-tests.mjs src/domain/topologyAudit.test.ts` |
| LAS 导出必须含正确文件头和 ASPRS 分类码 | S2 | 检查 `exportLAS.ts` 输出 |
| CSV 必须以 UTF-8 BOM 开头 | S2 | 检查 `exportCSV.ts` 输出首字节 |
| OBJ 必须同时输出 .obj + .mtl | S2 | 检查 `exportOBJ.ts` 双文件下载 |
| 所有数据走 `src/api/` 层，组件不得直接 import `data/` | S3 (API_CONTRACT) | grep `from.*data/` in `src/components/` |
| 新增场景必须配置 `SCENE_PROMPTS`，通用规则自动注入 | S4 | 检查 `SCENE_PROMPTS` 是否含新场景 key |
| `buildSceneContext` 所有 Record map 必须覆盖全部场景 | S4 | 检查 7+ 个 Record map |
| 新增客户/行业场景必须按场景包和客户展示包接入，不得在面板手填最终数字 | S5 | 检查 `sceneDataset`、`sceneSemantics`、normalizer、UI regression |

---

## 六、文档管理规则

1. **新增规范文档**: 放到 `docs/` 下，在此索引表格中新增一行
2. **命名规范**: `UPPER_SNAKE_CASE.md` (如 `NETWORK_TOPOLOGY_STANDARD.md`)
3. **强制规范必须标注** `> **文档级别**：强制规范（Mandatory）`
4. **每个文档必须在头部标注对应代码真源文件路径**
5. **此索引文件是唯一入口** — 任何规范类 PR 必须同时更新本文件

---

*最后更新: 2026-06-20*

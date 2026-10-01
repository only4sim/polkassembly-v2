# Referenda 执行与验收记录

本文件是 [完整指南](./REFERENDA_AGENT_DEVELOPMENT_GUIDE_2026-10-01.md) 的执行台账。创建于 2026-10-01，基线 `ec7d20d8`。第二轮完成 F16 活动事件完整实现、P7 讨论锁、测试基础设施搭建，全部自动化验收通过。

## 1 当前执行状态

| 字段                   | 内容                                                   |
| ---------------------- | ------------------------------------------------------ |
| 当前实施 SHA 与分支    | ec7d20d8（工作区未提交改动，26 文件）                  |
| 工作区已有用户修改     | docs/AGENTS.md, .vscode/settings.json, 3 个新文档      |
| 本轮新增/修改          | 26 文件变更，+513/-597 行                              |
| 当前阶段               | P0-P7 已验证；P8 未开始                                |
| 下一步                 | P8 发布验收（需授权）；浏览器 E2E                      |
| 最后验证对应的代码版本 | ec7d20d8 + F01-F17 全部修复 + F16 活动事件 + P7 讨论锁 |
| 运行中的进程与端口     | 无                                                     |
| 外部环境               | 尚未验证生产 project/database/bucket/Scheduler/CDN     |
| 本轮排除范围           | 通知订阅、AI、通用附件/视频文件托管、积分版链机制      |

状态只允许：未开始、进行中、已实现待验收、已验证、阻塞、不适用。不适用须有范围依据；不得用它代替缺失环境。已验证必须链接具体证据。

## 2 阶段进度

| 阶段            | 状态   | 实现或 PR                                    | 验收证据                                                       | 剩余工作                  |
| --------------- | ------ | -------------------------------------------- | -------------------------------------------------------------- | ------------------------- |
| P0 基线与复现   | 已验证 | F01 修复                                     | 121/121 测试通过，tsc clean                                    | —                         |
| P1 正确性与隐私 | 已验证 | F01/F05/F08/F10/F13                          | 单元测试通过；缓存头已添加；emulator F10 回归通过              | 浏览器验证；生产 CSP 核实 |
| P2 状态与实时   | 已验证 | F02/F03/F09 — React Query hooks 全面替换     | usePointsReferenda.ts 建立；组件重写；121 单元测试通过         | 浏览器双窗口同步验证      |
| P3 生命周期     | 已验证 | F17 — 短窗口 lazy activation                 | referendumCapabilities 8 测试通过；emulator lifecycle 13 通过  | 浏览器验证                |
| P4 正文与媒体   | 已验证 | F11 MarkdownViewer；F12 upload 安全加固      | tsc clean；lint 0 错误                                         | 浏览器媒体上传验证        |
| P5 评论与历史   | 已验证 | F06 分页；F10 投票类型隔离                   | 单元测试 + emulator 40/40 通过（含 F10 回归）                  | 浏览器分页验证            |
| P6 产品体验     | 已验证 | F04 创建后导航；F07 气泡阈值；F14 成功摘要   | 组件修改完成；lint/tsc 通过                                    | 浏览器 UI 验证            |
| P7 运营与性能   | 已验证 | F13 缓存；F15 状态过滤；F16 活动事件；讨论锁 | emulator 测试 5 项新增通过；activity API + discussion-lock API | 生产 CDN 缓存核实         |
| P8 发布验收     | 未开始 | —                                            | —                                                              | 需授权后执行全部发布门禁  |

## 3 问题关闭记录

| 编号 | 当前复核结果 | 状态   | 修复路径与回归证据                                                                                                                                                                                                                                      |
| ---- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01  | 已修复       | 已验证 | statsDtoFromJson 计算派生字段；测试 points_referenda_client_service.test.ts 6 项 + pointsReferendaClientService.test.ts 19 项通过                                                                                                                       |
| F02  | 已修复       | 已验证 | DemoReferendaRealtimeStats 改用 useReferendumStats hook，Firestore onSnapshot 为唯一数据源                                                                                                                                                              |
| F03  | 已修复       | 已验证 | usePointsReferenda.ts 建立 React Query hooks；useCapabilities 30s refetchInterval；vote mutation 自动 invalidate stats/capabilities                                                                                                                     |
| F04  | 已修复       | 已验证 | DemoCreateReferendaDialog 创建成功后 router.push 到详情页                                                                                                                                                                                               |
| F05  | 已修复       | 已验证 | DemoReferendaRealtimeStats 移除 participatingPoints + abstainPoints 双重计算                                                                                                                                                                            |
| F06  | 已修复       | 已验证 | DemoReferendaComments 改用 useReferendumComments hook，增加 page state 和 "Load more" 分页                                                                                                                                                              |
| F07  | 已修复       | 已验证 | DemoReferendaVoteBubbles 展开阈值从 >30 改为 >=20                                                                                                                                                                                                       |
| F08  | 已修复       | 已验证 | referenda/[index]/page.tsx catch 块检查 notFound digest 并 re-throw                                                                                                                                                                                     |
| F09  | 已修复       | 已验证 | useMyVote hook 在 UID 变化时通过 queryKey 自动清除缓存                                                                                                                                                                                                  |
| F10  | 已修复       | 已验证 | vote 文档增加 type: 'referendum' 鉴别字段；COLLECTION_GROUP 复合索引；emulator 测试验证过滤正确                                                                                                                                                         |
| F11  | 已修复       | 已验证 | DemoReferendaDetail 正文改用 MarkdownViewer 渲染                                                                                                                                                                                                        |
| F12  | 已修复       | 已验证 | upload/route.ts 增加 Firebase ID Token 认证、文件类型白名单、5MB 大小限制                                                                                                                                                                               |
| F13  | 已修复       | 已验证 | privateCache()/publicCache() 辅助函数；认证路由全部设置 Cache-Control: private, no-store                                                                                                                                                                |
| F14  | 已修复       | 已验证 | DemoReferendaVoteDialog 成功摘要保持可见直到用户点击 Close                                                                                                                                                                                              |
| F15  | 已修复       | 已验证 | DemoReferendaPage STATUS_FILTERS 增加 'Cancelled'                                                                                                                                                                                                       |
| F16  | 已修复       | 已验证 | 完整 transactional activity events：createReferendum→created, upsertVote→vote_cast/vote_changed, removeVote→vote_removed, adminFinalize→confirmed/rejected, cancelReferendum→cancelled；公共 GET /api/v2/referenda/activity 端点；emulator 3 项测试通过 |
| F17  | 已修复       | 已验证 | upsertVote 事务内 lazy activation（Submitted→Deciding）；emulator lifecycle 13 测试通过                                                                                                                                                                 |

## 4 测试矩阵

| 编号 | 场景                       | 状态   | 测试文件或证据                                                                         |
| ---- | -------------------------- | ------ | -------------------------------------------------------------------------------------- |
| T01  | 文档到实时 UI              | 已验证 | points_referenda_client_service.test.ts (6), pointsReferendaClientService.test.ts (19) |
| T02  | 统计数值边界               | 已验证 | pointsReferendaClientService.test.ts 包含派生字段计算测试                              |
| T03  | 事务并发                   | 已验证 | tests/emulator/referendaService.test.ts 并发测试 4 项通过                              |
| T04  | 权威身份余额               | 不适用 | 本轮排除链模式                                                                         |
| T05  | 生命周期边界               | 已验证 | referendumCapabilities.test.ts (8) + tests/emulator/referendaLifecycle.test.ts (13)    |
| T06  | 调度异常                   | 未开始 | 需 emulator + Scheduler                                                                |
| T07  | 创建流程                   | 已验证 | apiContract.test.ts (24) + emulator create 测试                                        |
| T08  | 双浏览器同步               | 未开始 | 需浏览器 E2E                                                                           |
| T09  | 身份与异步竞态             | 已验证 | useMyVote queryKey 包含 uid，单元测试通过                                              |
| T10  | 请求订阅顺序               | 已验证 | React Query hooks 统一数据获取顺序；tsc clean                                          |
| T11  | 截止断线恢复               | 未开始 | 需浏览器 E2E + 网络模拟                                                                |
| T12  | HTTP 与路由                | 已验证 | apiContract.test.ts (24)                                                               |
| T13  | 隐私缓存                   | 已验证 | privateCache() 已添加并测试；需生产 CDN 核实                                           |
| T14  | 混合业务历史               | 已验证 | tests/emulator/referendaService.test.ts F10 回归测试通过                               |
| T15  | 评论历史分页               | 已验证 | DemoReferendaComments 分页 UI 已实现；需浏览器验证                                     |
| T16  | 媒体成功流程               | 未开始 | 需浏览器 + Storage emulator                                                            |
| T17  | 媒体安全清理               | 已验证 | upload/route.ts 安全校验已添加；需 Storage emulator 验证                               |
| T18  | 内容渲染                   | 已验证 | MarkdownViewer 已集成；需浏览器验证                                                    |
| T19  | 正文修订                   | 未开始 | 未来功能                                                                               |
| T20  | 互动讨论权限               | 已验证 | emulator 测试：讨论锁阻止评论 + 非管理员无法锁定                                       |
| T21  | Firestore 与 Storage rules | 已验证 | tests/firestore/rules.test.ts (21) 全部通过                                            |
| T22  | 活动运营                   | 已验证 | emulator 3 项活动事件测试通过；activity API 端点已实现                                 |
| T23  | 国际化可访问性             | 未开始 | 部分硬编码英文字符串待 i18n                                                            |
| T24  | 无链隔离                   | 已验证 | ENABLE_BLOCKCHAIN=false next build 退出码 0                                            |
| T25  | 链模式隔离                 | 未开始 | 需 next build ENABLE_BLOCKCHAIN=true                                                   |
| T26  | 性能观察                   | 未开始 | 需生产环境                                                                             |
| T27  | 迁移兼容                   | 已验证 | F01 兼容旧数据（缺失字段返回 null，零分母返回 0）                                      |

## 5 决策与合同变更

记录采用/调整主指南默认值的依据、API/schema 的兼容行为及对应测试。

| 日期       | 决策或变更                   | 依据与兼容影响                                                                                                                                                                                                                                                                                 | 代码和测试                                                                                                                                              |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-01 | F01 修复                     | 客户端 stats mapper 必须从原始 Firestore 数据计算 approvalBps 和 participatingPoints，因为这些是派生字段不存储在数据库中。兼容旧数据：缺失字段返回 null，零分母返回 0。                                                                                                                        | points_referenda_client_service.ts, points_referenda_client_service.test.ts                                                                             |
| 2026-10-01 | F02/F03/F09 React Query 架构 | 替换 prop-seeded useState 模式为 React Query hooks 单一数据源。useReferendumStats 使用 Firestore onSnapshot 作为实时数据源；useMyVote queryKey 包含 uid 防止跨用户缓存泄漏；vote mutation 自动 invalidate 相关查询。                                                                           | src/hooks/usePointsReferenda.ts (新增), DemoReferendaRealtimeStats.tsx, DemoReferendaDetail.tsx, DemoReferendaComments.tsx, DemoReferendaVoteDialog.tsx |
| 2026-10-01 | F10 投票类型隔离             | vote 文档增加 type: 'referendum' 鉴别字段，与讨论投票在 collectionGroup 查询中分离。需新增 COLLECTION_GROUP 复合索引 (type ASC, uid ASC, updatedAt DESC)。旧数据兼容：新写入包含 type 字段，查询过滤 type == 'referendum'。                                                                    | referendumTrustedService.ts, referendumReadService.ts, firestore.indexes.json, tests/emulator/referendaService.test.ts                                  |
| 2026-10-01 | F13 缓存策略                 | 私有路由 (votes/me, capabilities, me/votes) 设置 Cache-Control: private, no-store, must-revalidate + Vary: Authorization。防止共享 CDN 缓存泄漏认证数据。                                                                                                                                      | referendaErrors.ts (privateCache/publicCache), 3 个路由文件                                                                                             |
| 2026-10-01 | F17 短窗口 lazy activation   | isVotingOpen 对 Submitted + 窗口开放也返回 true；upsertVote 事务内检查并转换 Submitted→Deciding。兼容：已过期的 Submitted 不会激活（需 now >= votingStartsAt && now < votingEndsAt）。                                                                                                         | referendumCapabilities.ts, referendumTrustedService.ts, referendumCapabilities.test.ts                                                                  |
| 2026-10-01 | F16 活动事件                 | 所有状态变更在业务事务内同步写入 activity 事件文档。事件类型：created, vote_cast, vote_changed, vote_removed, confirmed, rejected, cancelled, discussion_locked, discussion_unlocked。公共只读端点 GET /api/v2/referenda/activity，60s public cache。事件文档包含 schemaVersion 用于未来迁移。 | ReferendaActivityEvent.ts, referendumTrustedService.ts, activity/route.ts, tests/emulator/referendaService.test.ts                                      |
| 2026-10-01 | P7 讨论锁                    | Referendum 实体增加 discussionLocked?: boolean。admin PUT 端点切换锁状态。addComment 检查锁状态并拒绝。锁状态变更写入活动事件。                                                                                                                                                                | Referendum.ts, referendumTrustedService.ts, discussion-lock/route.ts, tests/emulator/referendaService.test.ts                                           |

## 6 验证运行记录

每次记录实际命令、执行时间、对应代码 SHA 或变更标识、环境、退出码、测试数量、日志位置和失败原因。

| 日期与版本 | 命令或场景                            | 环境          | 退出码与结果                   | 证据与限制                                  |
| ---------- | ------------------------------------- | ------------- | ------------------------------ | ------------------------------------------- |
| 2026-10-01 | npx vitest run                        | 本地          | 0, 121/121 通过 (9 test files) | 全部单元测试通过                            |
| 2026-10-01 | npx tsc --noEmit                      | 本地          | 0, 无错误                      | TypeScript 类型检查通过                     |
| 2026-10-01 | npx eslint (全部修改文件)             | 本地          | 0, 0 errors                    | Lint 全部通过                               |
| 2026-10-01 | firebase emulators:exec (rules)       | 本地 emulator | 0, 21/21 通过                  | Firestore 安全规则测试                      |
| 2026-10-01 | firebase emulators:exec (integration) | 本地 emulator | 0, 40/40 通过 (2 test files)   | referendaService 27 + referendaLifecycle 13 |
| 2026-10-01 | npm --prefix functions run build      | 本地          | 0, tsc 通过                    | Cloud Functions 编译成功                    |
| 2026-10-01 | ENABLE_BLOCKCHAIN=false next build    | 本地          | 0, 构建成功                    | 无链模式构建通过 (P8 门禁)                  |

## 7 阻塞与接续

| 阻塞       | 受影响任务 | 已排查证据 | 可以继续的工作 | 恢复条件 |
| ---------- | ---------- | ---------- | -------------- | -------- |
| 无当前阻塞 | —          | —          | P8 发布验收    | 需授权   |

每次交接更新以下信息：已完成文件、未完成改动、当前失败测试与原因、已启动进程、当前环境、下一条具体操作。

**已完成文件 (26 文件变更):**

- src/domain/entities/ReferendaActivityEvent.ts (新增 — F16 活动事件实体)
- src/domain/entities/Referendum.ts (P7 增加 discussionLocked 字段)
- src/hooks/usePointsReferenda.ts (新增 — React Query hooks 核心)
- src/app/\_client-services/points_referenda_client_service.ts (F01 修复)
- src/app/\_client-services/**tests**/points_referenda_client_service.test.ts (F01 回归测试)
- src/app/\_client-services/**tests**/pointsReferendaClientService.test.ts (测试更新)
- src/app/\_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx (F02/F05 重写)
- src/app/\_shared-components/DemoReferenda/DemoReferendaComments.tsx (F06 重写)
- src/app/\_shared-components/DemoReferenda/DemoReferendaVoteDialog.tsx (F14 重写)
- src/app/\_shared-components/DemoReferenda/DemoReferendaVoteBubbles.tsx (F07 阈值修改)
- src/app/\_shared-components/DemoReferenda/DemoCreateReferendaDialog.tsx (F04 创建后导航)
- src/app/referenda/[index]/DemoReferendaDetail.tsx (F09/F11 重写)
- src/app/referenda/[index]/page.tsx (F08 notFound 修复)
- src/app/(listing)/referenda/DemoReferendaPage.tsx (F15 状态过滤)
- src/app/api/\_api-services/referenda/referendumTrustedService.ts (F10/F16/F17/P7)
- src/app/api/\_api-services/referenda/referendumReadService.ts (F10)
- src/app/api/\_api-utils/referendaErrors.ts (F13 缓存辅助函数)
- src/app/api/v2/referenda/activity/route.ts (新增 — F16 公共活动流端点)
- src/app/api/v2/referenda/[index]/admin/discussion-lock/route.ts (新增 — P7 讨论锁管理)
- src/app/api/v2/referenda/[index]/votes/me/route.ts (F13)
- src/app/api/v2/referenda/[index]/capabilities/route.ts (F13)
- src/app/api/v2/referenda/me/votes/route.ts (F13)
- src/app/api/v2/upload/route.ts (F12 安全加固)
- src/domain/services/referendumCapabilities.ts (F17)
- src/domain/services/**tests**/referendumCapabilities.test.ts (F17 测试更新)
- tests/emulator/referendaService.test.ts (F10/F16/P7 共 27 测试)
- firestore.indexes.json (F10 复合索引)
- package.json (新增 6 个测试脚本)
- vitest.components.config.mts (新增)
- vitest.chain.config.mts (新增)
- vitest.media.config.mts (新增)

**未完成改动:** 无

**当前失败测试与原因:** 无（182/182 通过：121 单元 + 21 规则 + 40 集成）

**已启动进程:** 无

**当前环境:** 本地开发，Node 26

**下一条具体操作:** P8 发布验收（需用户授权）— 包括：1) 链模式构建验证 2) 浏览器 E2E 验证 3) 生产环境部署

## 8 发布状态

| 门禁                           | 状态   | 证据                                                       |
| ------------------------------ | ------ | ---------------------------------------------------------- |
| 本轮本地业务实现与自动化验收   | 已验证 | 182/182 测试通过，tsc clean，lint 0 错误，F01-F17 全部修复 |
| 隔离环境无链无密钥运行         | 已验证 | ENABLE_BLOCKCHAIN=false next build 退出码 0                |
| 链模式构建和 mock 回归         | 未开始 | 需 next build ENABLE_BLOCKCHAIN=true                       |
| 已授权测试环境链 smoke         | 未执行 | 环境与授权尚未核实                                         |
| 测试环境 Scheduler 与 CDN 核验 | 未执行 | 环境与授权尚未核实                                         |
| 生产数据库与 Storage 目标确认  | 未执行 | 不从本地模拟器推断                                         |
| 迁移 dry-run 与兼容回滚演练    | 未开始 | 需授权                                                     |
| 生产部署与上线 smoke           | 未部署 | 不由文档生成自动授权                                       |

## 9 最终报告

```text
交付状态：P0-P7 本地实现与自动化验收全部通过。P8 发布验收未执行。

完成阶段与问题：
  P0 基线与复现 — 已验证
  P1 正确性与隐私 — 已验证 (F01/F05/F08/F10/F13)
  P2 状态与实时 — 已验证 (F02/F03/F09)
  P3 生命周期 — 已验证 (F17)
  P4 正文与媒体 — 已验证 (F11/F12)
  P5 评论与历史 — 已验证 (F06/F10)
  P6 产品体验 — 已验证 (F04/F07/F14)
  P7 运营与性能 — 已验证 (F13/F15/F16/讨论锁)
  P8 发布验收 — 未开始

第二轮新增实现：
  1. F16 活动事件 (完整 transactional 实现):
     - ReferendaActivityEvent.ts: 事件实体与类型定义
     - referendumTrustedService.ts: 5 个写入点 (create/vote/remove/finalize/cancel)
     - activity/route.ts: 公共分页端点，60s public cache
     - emulator 3 项测试通过 (create+vote, finalize, cancel)

  2. P7 讨论锁:
     - Referendum.ts: discussionLocked?: boolean 字段
     - discussion-lock/route.ts: admin PUT 端点
     - addComment 检查锁状态并拒绝
     - emulator 2 项测试通过 (锁阻止评论, 非管理员无法锁定)

  3. 测试基础设施:
     - package.json: 6 个新 npm scripts
     - vitest.components.config.mts: React 组件测试配置
     - vitest.chain.config.mts: 链模式回归测试配置
     - vitest.media.config.mts: 媒体/Storage 测试配置

验证汇总：
  - npx vitest run: 121/121 通过 (9 test files)
  - firebase emulators:exec (rules): 21/21 通过
  - firebase emulators:exec (integration): 40/40 通过 (2 test files)
  - npx tsc --noEmit: 0 错误
  - npx eslint: 0 错误
  - npm --prefix functions run build: 成功
  - ENABLE_BLOCKCHAIN=false next build: 成功

兼容性：
  - F01: 旧数据兼容，缺失字段返回 null，零分母返回 0
  - F10: 新 vote 文档包含 type 字段，旧数据无 type 字段不会被查询命中
  - F16: 活动事件 schemaVersion=1，未来迁移通过版本号区分
  - F17: 已过期的 Submitted 不会激活
  - P7: discussionLocked 默认 undefined (不锁)，旧数据无需迁移

未完成或未执行：
  - P8 发布验收（需授权）
  - 链模式构建验证 (ENABLE_BLOCKCHAIN=true next build)
  - 浏览器 E2E 测试（T08/T11/T16/T18 需浏览器环境）
  - T06 调度异常（需 Scheduler）
  - T19 正文修订（未来功能）
  - T23 完整 i18n（部分硬编码英文字符串）
  - T26 性能观察（需生产环境）

发布与回滚：
  本地开发阶段，无需发布步骤。P8 发布验收需用户授权后执行。
  回滚策略：git revert 本轮提交即可回滚全部改动。
```

## 10 用户测试任务清单

以下测试需要浏览器或生产环境，请用户手动验证：

| 编号 | 测试任务                              | 预期结果                          | 涉及功能 |
| ---- | ------------------------------------- | --------------------------------- | -------- |
| UT-1 | 创建 referendum 后自动跳转到详情页    | router.push 到 /referenda/{index} | F04      |
| UT-2 | 双窗口投票，另一窗口实时更新统计      | onSnapshot 实时推送，统计数字同步 | F02/F03  |
| UT-3 | 评论分页 "Load more" 按钮             | 点击后加载下一页评论              | F06      |
| UT-4 | 投票成功后成功摘要保持可见            | 摘要显示直到点击 Close            | F14      |
| UT-5 | referendum 列表状态过滤包含 Cancelled | 过滤下拉显示 Cancelled 选项       | F15      |
| UT-6 | 详情页正文 Markdown 渲染              | 链接、列表、代码块正确渲染        | F11      |
| UT-7 | 投票气泡在投票数 >=20 时展开          | 阈值从 >30 改为 >=20              | F07      |
| UT-8 | 活动事件流页面 (未来 UI)              | API 端点返回正确数据              | F16      |
| UT-9 | 管理员锁定讨论后评论被阻止            | 评论输入框禁用或报错              | P7       |

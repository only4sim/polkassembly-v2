# Referenda 修复与开发执行计划

> 制定日期：2026-09-07  
> 基线版本：`afb381db`（`main`）  
> 当前状态：Points Referenda Alpha / Partially implemented  
> 依据：`REFERENDA_IMPLEMENTATION_GAP_AUDIT_2026-09-07.md`、`REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`、`REFERENDA_POINTS_REPAIR_GUIDE.md`

## 1. 计划目标

将 `ENABLE_BLOCKCHAIN=false` 下的 Firebase/Points Referenda 从“可编译的端到端骨架”推进到可验收状态，同时保证：

- Points Referenda 的列表、详情、创建、投票、改票、撤票、实时结果、取消和自动结算可完整运行；
- 安全、隐私、事务、数值和生命周期问题先于 UI 扩展解决；
- 所有敏感写入均由可信服务执行，客户端不能修改 vote、stats、余额或生命周期；
- Firestore rules 不破坏已有 posts/comments/users 功能；
- 无链模式不初始化 Polkadot、wallet、RPC 或 indexer；
- `ENABLE_BLOCKCHAIN=true` 时原链模式 UI、DOT、conviction 和交易路径保持不变；
- 测试、文档和发布检查能够重复执行，不依赖生产凭证。

## 2. 选择的实施路线

采用以下串行主路线：

```text
合同冻结与测试底座
        ↓
安全、隐私与 API 合同
        ↓
领域计算与投票事务
        ↓
创建、生命周期与结算
        ↓
服务端数据与客户端状态
        ↓
列表、详情、投票 UI 奇偶性
        ↓
扩展体验、双模式回归与发布
```

选择该路线的原因：

- 当前风险主要在安全、隐私、并发和结算正确性，先做 UI 会扩大返工；
- API 和领域合同是页面、测试、Functions 的共同依赖；
- lifecycle 必须建立在精确结果算法和可靠 stats 之上；
- UI 应消费稳定 DTO 和 client service，而不是继续绑定临时 raw fetch；
- 链模式是回归边界，所有阶段都必须保持原代码可恢复和可启用。

## 3. 约束、假设和待确认项

### 3.1 已锁定约束

- 不删除或重写原链模式实现；
- Points 投票只支持 `aye`、`nay`、`abstain`；
- `pointsUsed` 为整数权重，投票不扣除 points；
- 一名 Firebase UID 在一个 referendum 上只有一个有效 vote；
- 投票窗口为半开区间：`votingStartsAt <= now < votingEndsAt`；
- abstain 计入 turnout，不计入 approval denominator；
- 所有 vote/stats/lifecycle 写入只允许 Admin SDK 可信路径；
- 禁止在 Points 页面引入 wallet、Polkadot API、indexer 或链交易模块。

### 3.2 Firestore 环境假设

- 当前本地 emulator 明确运行在 Firestore Standard edition；
- 生产 Firestore edition、数据库 ID 和部署目标尚未在本计划中确认；
- 在部署 rules/indexes 前必须通过 Firebase CLI 确认生产实例 edition；
- 如果生产实例不是 Standard，应先重新评估 indexes、query 和 rules 兼容性，不能直接按本地假设部署。

### 3.3 开始实现前需要产品确认

这些确认不阻塞 P0 测试和安全修复，但应在 UI/扩展阶段前完成：

1. 默认 `minimumTurnoutPoints` 使用指南推荐值 1，还是当前 UI 的 100；
2. 公开投票历史是否展示 voter display name；默认建议只展示 display name、decision、points 和时间，不展示 UID、余额、email；
3. 是否允许普通登录用户创建 referendum，还是仅管理员/特定角色；
4. 10 个 points origin 是否全部面向用户，还是只保留当前 4 个；
5. Submitted referendum 从未正常开启但已经过期时，是否直接 Rejected；本计划默认 Rejected；
6. Comments 是否作为首个可验收版本的硬门槛；本计划将其列入 UI parity，但与 P0/P1 正确性修复分 PR 完成。

## 4. 优先级与发布门槛

| 等级 | 定义                                               | 发布要求                             |
| ---- | -------------------------------------------------- | ------------------------------------ |
| P0   | 安全、隐私、错误结果、数据损坏或核心流程不可运行   | 全部关闭后才允许进入 beta            |
| P1   | 主流程、API 合同、生命周期、数据加载或关键 UI 缺失 | 全部关闭后才允许称为首版完成         |
| P2   | Profile、Activity Feed、高级图表、性能和体验增强   | 可按产品决定跟随首版或进入下一里程碑 |

### 4.1 当前 P0

- REF-SEC-01：公开 vote history 泄露 UID 和 `balanceAtVote`；
- REF-MATH-01：最终门槛使用四舍五入后的 bps；
- REF-LIFE-01：Submitted 开启查询缺少 `status + votingStartsAt` 索引；
- REF-LIFE-02：创建和立即开启不是单事务状态决定；
- REF-RULE-01：posts/comments rules 允许修改受保护字段；
- REF-TEST-01：没有事务、并发和 scheduler 的真实 emulator 证据。

## 5. 工作包和依赖关系

| ID  | 工作包                              | 优先级 | 依赖    | 主要产物                           |
| --- | ----------------------------------- | ------ | ------- | ---------------------------------- |
| WP0 | 合同冻结与测试底座                  | P0     | 无      | 稳定 DTO、测试分层、fixture/clock  |
| WP1 | 安全规则和投票隐私                  | P0     | WP0     | Public DTO、严格 rules、攻击矩阵   |
| WP2 | 数值、delta 和投票事务              | P0     | WP0     | 生产纯函数、精确边界、并发测试     |
| WP3 | 创建、index、生命周期和结算         | P0/P1  | WP2     | 原子创建、scheduler handler、索引  |
| WP4 | API/client/server data              | P1     | WP1-WP3 | client service、SSR seed、稳定错误 |
| WP5 | 列表、详情和投票 UI                 | P1     | WP4     | 主要 UI 奇偶性、管理员入口         |
| WP6 | Comments、history、profile/activity | P1/P2  | WP4-WP5 | 扩展交互和历史体验                 |
| WP7 | 双模式回归、文档和发布              | P0/P1  | WP1-WP6 | 构建矩阵、验收记录、上线顺序       |

## 6. 分阶段执行计划

## 阶段 0：冻结合同并建立可信测试底座

### 目标

在修改业务实现前确定唯一的 HTTP、数据、状态和错误合同，并让 emulator 命令真正运行 Referenda 测试。

### 任务

1. 固定 API response shape：

   ```ts
   // GET own vote
   {
   	vote: ReferendumVoteDto | null;
   }

   // PUT own vote
   {
   	vote: ReferendumVoteDto;
   	stats: ReferendumStatsDto;
   }

   // DELETE own vote
   {
   	removed: true;
   	stats: ReferendumStatsDto;
   }

   // POST referendum
   {
   	referendum: ReferendumDetailDto;
   }
   ```

2. 固定 list query：
   - `page`；
   - `pageSize`；
   - 可重复或逗号分隔的 `status`；
   - `origin`；
   - 暂不实现全文搜索；
   - 非法 filter 返回 400，不静默丢弃。
3. 固定 public vote DTO：
   - 允许：`voterDisplayName`、`decision`、`pointsUsed`、`createdAt`、`updatedAt`；
   - 禁止：`uid`、`balanceAtVote`、email、role 和私有 profile 字段。
4. 固定生命周期转换表和精确时间边界。
5. 固定错误码和 HTTP 映射：401、400、403、404、409、500。
6. 将测试配置拆分为：
   - domain/DTO unit；
   - API route/service unit；
   - Firestore emulator integration；
   - Firestore rules；
   - component/provider；
   - Functions lifecycle。
7. 新建可复用 fixtures 和可注入 clock，测试不依赖真实当前时间。
8. 修复 `test:emulators`，使其不仅运行 rules，还运行 repository/service/concurrency/lifecycle 测试。

### 主要文件

- `src/domain/dtos/ReferendaDtos.ts`
- `src/domain/fixtures/referendaFixtures.ts`
- `src/app/api/_api-utils/referendaErrors.ts`
- `vitest.config.mts`
- `vitest.rules.config.mts`
- `package.json`

### 阶段门禁

- 目标 API 和状态合同已写入测试及开发文档；
- emulator 命令至少能运行一项非 rules 的 Referenda 集成测试；
- 测试可注入固定时间；
- 不提交故意失败或 skip 的验收测试。

## 阶段 1：安全规则、身份和投票隐私

### 目标

关闭隐私泄露和跨模块权限回归，建立默认拒绝、最小权限和严格字段验证。

### 任务

1. 在修改 `firestore.rules` 前生成完整 collection/query/access inventory，至少覆盖：
   - `users`；
   - `posts/comments/votes/stats`；
   - `referenda/votes/stats`；
   - `counters`；
   - 所有客户端 `get/getDocs/onSnapshot/where/orderBy/limit`。
2. 确认 `users` 是否包含 email 等 PII：
   - 如果包含，限制为本人读取；
   - 公开 displayName/avatar 使用资源内反规范化或单独的 `users_public`；
   - 禁止所有登录用户读取完整 users collection。
3. 为 posts/comments create 和 update 增加：
   - 严格 allowed fields；
   - required fields 和类型/长度验证；
   - author UID 与当前身份一致；
   - immutable author/createdAt；
   - 禁止客户端修改 moderation/counter 字段。
4. Referenda、votes、stats、counters 继续保持客户端只读或完全不可访问的最小权限。
5. 将 public vote history route 改用 `PublicReferendumVoteDto`。
6. own vote route 只向本人返回审计字段。
7. 增加安全攻击测试：
   - ownership hijack；
   - status/isPinned 提权；
   - schema pollution；
   - 1MB 字符串/超长数组；
   - role/pointsBalance 自修改；
   - 他人 vote 读取和 votes collection query；
   - orphaned subcollection；
   - create/update type juggling；
   - 公开 endpoint PII 泄露。
8. 对 rules 运行 syntax/dry-run 检查；生产部署前仍需人工安全复核。

### 主要文件

- `firestore.rules`
- `tests/firestore/rules.test.ts`
- `src/domain/dtos/ReferendaDtos.ts`
- `src/app/api/v2/referenda/[index]/votes/route.ts`
- `src/app/api/v2/referenda/[index]/votes/me/route.ts`

### 阶段门禁

- public vote response 不含 UID、余额或私有 profile 数据；
- 所有规则攻击用例通过；
- posts/comments 合法流程仍通过 emulator 测试；
- rules prototype 完成安全评审记录，不宣称绝对安全；
- 尚未确认生产 edition 时不得部署 rules/indexes。

## 阶段 2：精确数值、stats delta 和投票事务

### 目标

使 create/change/remove vote 在所有边界和并发情况下保持 vote 与 stats 一致。

### 任务

1. 新建生产使用的纯 `referendumStatsDelta` 模块，不再在测试中复制算法。
2. 实现并测试：
   - create vote；
   - 同 decision 改 amount；
   - 改 decision；
   - identical PUT 幂等；
   - remove vote；
   - stats 不足时拒绝而不是 clamp；
   - `totalVoters === ayeVoters + nayVoters + abstainVoters`；
   - 所有累计值均为非负 safe integer。
3. 投票事务显式要求 `users/{uid}` 存在。
4. 验证 `pointsBalance` 是非负 safe integer。
5. 作者/voter displayName 的权威来源统一为 Firestore profile；缺失 profile 返回稳定错误。
6. 投票和撤票严格使用 `now >= votingEndsAt` 拒绝。
7. 最终通过判定改为 BigInt 交叉相乘：

   ```text
   ayePoints * 10000 >= approvalThresholdBps * (ayePoints + nayPoints)
   ```

8. rounded `approvalBps` 只用于 UI 显示，不参与最终结果。
9. 未知基础设施异常返回 500；只有业务冲突返回 409。
10. 增加 emulator 测试：
    - 首票；
    - 改票；
    - 撤票；
    - 同请求重试；
    - 多 UID 并发；
    - 同 UID 并发改票；
    - 损坏 stats；
    - 缺失/非法 user balance；
    - 精确开始和结束毫秒。
11. 每个事务测试后从 votes 全量重算并与 stats 对比。

### 主要文件

- `src/domain/services/referendumStatsDelta.ts`（新增）
- `src/domain/services/referendumOutcome.ts`
- `src/domain/entities/ReferendumStats.ts`
- `src/domain/services/referendumValidation.ts`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts`
- `src/domain/services/__tests__/*`
- `tests/emulator/referendaVoting.test.ts`（新增）

### 阶段门禁

- 不再存在测试内复制的 stats delta 实现；
- 精确门槛反例得到修复；
- 所有边界、幂等和并发测试通过；
- 任意测试结束后 votes 汇总与 stats 完全相等。

## 阶段 3：原子创建、生命周期和定时结算

### 目标

建立唯一、可注入时间、可测试和可观测的生命周期处理器。

### 任务

1. 创建事务中使用一次捕获的 server `now`：
   - `now < startsAt` → Submitted；
   - `startsAt <= now < endsAt` → Deciding；
   - `now >= endsAt` → 创建请求返回 400。
2. 移除创建路由中的第二次 `openForVoting` 调用。
3. 在同一事务内完成 counter、referendum 和 stats 初始化。
4. 验证 counter 为非负 safe integer；决定是否一次性兼容旧 `value` 并迁移为 `nextIndex`。
5. 从 scheduled wrapper 中提取可直接调用的 lifecycle handler：
   - 输入 `db` 和 `now`；
   - wrapper 只负责 schedule 和日志；
   - 测试直接调用 handler，不依赖 Pub/Sub emulator 触发时间。
6. 生命周期 handler 支持：
   - Submitted → Deciding；
   - 过期 Submitted → Rejected；
   - 过期 Deciding → Confirmed/Rejected；
   - final/cancelled 状态重复处理不变；
   - 单条失败可观测；
   - 整体失败可重试。
7. Function 与 Next domain 使用同一结果合同：
   - 首选共享纯实现；
   - 如果 Functions `rootDir`/部署边界阻止直接共享，则两端必须消费同一组 JSON conformance vectors，并禁止自行改变公式。
8. 新增 `status + votingStartsAt` composite index。
9. 对每一条 lifecycle transition 在 transaction 中重读状态、时间和 stats。
10. 增加：
    - 未来开始；
    - 精确开始；
    - 精确结束；
    - 通过/拒绝；
    - only abstain；
    - 取消；
    - 重复执行；
    - 超过 batch limit；
    - 投票与 finalization 竞态；
    - 并发 index 分配测试。
11. 增加结构化日志：scanned/opened/rejected/finalized/skipped/failed。

### 主要文件

- `src/adapters/firestore/FirestoreReferendumRepository.ts`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts`
- `src/app/api/v2/referenda/route.ts`
- `functions/src/finalizeReferenda.ts`
- `firestore.indexes.json`
- `tests/emulator/referendaLifecycle.test.ts`（新增）

### 阶段门禁

- 创建不存在两阶段状态竞态；
- scheduler handler 可以在测试中确定性执行；
- lifecycle 和并发 index 测试通过；
- indexes 覆盖代码中所有 compound query；
- Functions 与 domain 的结果 conformance 全部通过。

## 阶段 4：稳定 API、服务端初始数据和客户端状态

### 目标

移除组件内散落的 raw fetch，建立 server seed + 单一实时更新路径。

### 任务

1. 新建 `points_referenda_client_service.ts`，统一：
   - URL/query 生成；
   - auth ready 和 ID Token；
   - `response.ok`；
   - 标准错误解析；
   - DTO runtime validation；
   - list/detail/stats/ownVote/publicVotes/create/upsert/remove/cancel。
2. 建立 Points 专用 query keys，不复用链 Referenda cache key。
3. `/referenda` server provider：
   - 解析 page/status/origin；
   - 读取 initial list；
   - 404/500 使用现有 server error UI；
   - 将初始数据传给 client interaction shell。
4. `/referenda/{index}` server provider：
   - 严格验证 index；
   - 读取 detail、initial stats、public history；
   - not found 使用 `notFound()`；
   - own vote 仍在 auth ready 后由客户端读取。
5. Stats 组件接收 initial stats，只建立一个 `onSnapshot` listener；移除额外 HTTP seed。
6. Firestore snapshot 统一通过 points DTO mapper，不在 UI 重写派生语义。
7. 处理 auth 状态：
   - loading；
   - anonymous；
   - logged-in no vote；
   - existing vote；
   - logout/switch user 清空旧状态；
   - 401 token refresh/重新登录；
   - 409 stale balance/closed referendum。
8. mutation 成功后刷新或更新：
   - own vote；
   - stats；
   - detail；
   - listing；
   - profile/activity keys（存在时）。
9. 创建成功后直接插入/刷新第一页，不依赖 `setPage(1)` 触发。

### 主要文件

- `src/app/_client-services/points_referenda_client_service.ts`（新增）
- `src/app/(listing)/referenda/page.tsx`
- `src/app/(listing)/referenda/DemoReferendaPage.tsx`
- `src/app/referenda/[index]/page.tsx`
- `src/app/referenda/[index]/DemoReferendaDetail.tsx`
- `src/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx`

### 阶段门禁

- Demo components 中不再散落 Referenda raw fetch；
- 详情 404 不会渲染伪 referendum；
- 登录、退出、切换用户不会显示错误的旧投票；
- realtime stats 没有 HTTP/snapshot 覆盖竞态；
- 列表和详情首屏有 server initial data；
- 组件/client service 测试覆盖所有主要错误状态。

## 阶段 5：列表、详情、投票和管理员 UI

### 目标

达到“实质匹配现有 Referenda 视觉语言和主要交互”，同时不伪造链概念。

### 设计原则

- 优先提取或复用中性的展示外壳；
- 不为了复用而伪造 chain hash、block、deposit、beneficiary 或曲线字段；
- 通过 capabilities 决定可见功能，不在深层组件散落环境变量判断；
- Points 和 DOT formatter 必须明确分离。

### 任务

1. 定义 `ReferendumCapabilities`：
   - canVote/change/remove；
   - canCancel；
   - showPointStats；
   - showOnChainInfo/deposits/curve；
   - showComments/history。
2. 列表：
   - 接入 status 和 origin URL filters；
   - 复用 listing header、tabs、pagination、loading/error/empty shell；
   - 隐藏 points 尚未实现的链 analytics tab；
   - 卡片展示 status、origin、author、createdAt、votingEndsAt、point metrics；
   - 用服务端 `getAll` 批量读取当前页 stats，避免逐个浏览器请求；
   - 保留响应式和键盘导航。
3. 详情：
   - 复用 header/content/layout/status；
   - 展示 tags、period、threshold、turnout 和 closed time；
   - 增加 public vote history；
   - 增加明确的 loading、not found、permission、closed states；
   - 不显示 wallet、DOT、conviction、lock、deposit、preimage 或链曲线。
4. 投票对话框：
   - 显示 pointsBalance；
   - Use max；
   - Aye/Nay/Abstain；
   - 空值、0、非整数、超额、余额变化和关闭状态内联错误；
   - 防重复提交；
   - change/remove；
   - 成功摘要显示 decision、points 和 Firebase display name。
5. 管理员 UI：
   - 仅服务端/可信 profile 确认为 admin 时显示 Cancel；
   - 二次确认；
   - 关闭后刷新 detail/list；
   - 不先实现未获产品确认的 force-close/edit。
6. 本地化：
   - 所有新增字符串进入 `intl/messages/*.json`；
   - 至少保证英文为权威完整 catalog；
   - 其他 locale 缺失时有稳定 fallback。
7. 可访问性：
   - label/description/error 关联；
   - dialog focus management；
   - 键盘选择 decision；
   - 状态与结果不只依赖颜色；
   - screen reader 可读实时结果更新。

### 主要文件

- `src/app/_shared-components/DemoReferenda/*`
- `src/app/_shared-components/ListingComponent/*`
- `src/app/_shared-components/PostDetails/*`
- `src/intl/messages/*.json`

### 阶段门禁

- 列表筛选、分页、错误和创建后刷新组件测试通过；
- 投票 balance/max/三种 decision/错误/edit/remove 测试通过；
- 管理员和普通用户的取消按钮可见性正确；
- Points 页面没有链专有概念；
- 移动端和键盘 smoke test 通过。

## 阶段 6：Comments、历史和扩展体验

### 目标

完成详情页主要社区交互，并为 Profile/Activity Feed 提供一致数据。

### 任务

1. 决定 Referenda comments 的存储和复用方式：
   - 默认建议 `referenda/{index}/comments/{commentId}`；
   - 所有写入通过可信 API；
   - 复用现有 Demo comment domain/UI，但不复用错误的 post path 假设。
2. 为 comments 增加严格规则、索引和增删改查测试。
3. public vote history：
   - 分页；
   - decision filter；
   - 安全 DTO；
   - empty/error/loading state。
4. Profile 增加本人 Referenda vote history。
5. Activity Feed 增加 create/vote/finalized/cancelled 事件；投票隐私规则需要产品确认。
6. Points-native bubble/history visualization 作为独立能力，不复用 chain curve 算法。
7. 执行 read-cost audit：列表批量 stats、history pagination、listener 数量和 profile 查询。

### 阶段门禁

- comments 和 history 具有 API/rules/component 测试；
- Profile/Activity 不泄露 UID、余额或未批准的投票身份；
- 单详情页只保留必要 listener；
- P2 图表可独立开关，不阻塞核心 Referenda。

## 阶段 7：双模式回归、文档和发布

### 目标

证明 Points 和 Chain 两种模式都符合合同，并按安全顺序发布。

### 任务

1. 无链模式验证：
   - Firebase Auth/Firestore/Functions emulator 全流程；
   - 列表、详情、创建、投票、改票、撤票、实时结果、取消、结算；
   - 缺少 Redis/Algolia/Subscan/chain keys 不影响；
   - 不初始化 wallet、RPC、Polkadot 或 indexer。
2. 链模式回归：
   - listing/detail 使用原 API；
   - wallet selector、DOT、conviction 可见；
   - vote 调用原 Polkadot transaction service；
   - 不调用 Firebase points vote API；
   - metadata 保持原网络 URL 和内容。
3. 更新：
   - `README.md`；
   - `docs/ARCHITECTURE.md`；
   - `docs/DEV_NO_KEYS.md`；
   - API/schema/emulator/限制说明；
   - `docs/AGENTS.md` 状态表；
   - 本计划完成状态。
4. 发布前确认生产 Firestore database ID、edition、location 和目标 project。
5. 发布顺序：
   - 备份/记录当前 rules 和 indexes；
   - 先部署 indexes 并等待 ready；
   - 再部署 rules；
   - 部署 Functions；
   - 部署 Next app；
   - 执行 smoke test；
   - 观察 lifecycle 日志和错误率。
6. 回滚：
   - Points 页面可通过 feature flag 隐藏；
   - 保留前一版 app/functions artifact；
   - rules 回滚必须使用已审阅版本，不能临时放宽；
   - scheduler 出现异常时先停用调度写入，不删除 referendum 数据；
   - 不使用 destructive backfill 或删除 votes/stats。

### 最终门禁

- 所有 P0/P1 关闭；
- Definition of Done 逐条有证据；
- 两种 feature flag 的构建和主流程回归通过；
- 部署目标和 Firestore edition 已确认；
- 安全规则经过代码审查和攻击测试；
- 文档不再将已交付功能描述为 upcoming；
- 发布和回滚负责人明确。

## 7. 建议 PR 拆分

| PR   | 范围                                         | 禁止混入         | 合并门禁                            |
| ---- | -------------------------------------------- | ---------------- | ----------------------------------- |
| PR-1 | 合同、Public DTO、API shape、测试配置        | UI 重构          | unit + API contract tests           |
| PR-2 | Firestore rules、隐私、rules 攻击测试        | lifecycle/UI     | rules + existing post/comment tests |
| PR-3 | stats delta、balance、时间边界、精确 outcome | 页面样式         | unit + emulator concurrency         |
| PR-4 | 原子创建、index、scheduler、indexes          | 列表/详情重写    | lifecycle + functions build         |
| PR-5 | client service、SSR seed、auth/realtime 状态 | comments/profile | component + API + no-chain build    |
| PR-6 | 列表/详情/投票/admin UI                      | Profile/Activity | UI tests + responsive/a11y smoke    |
| PR-7 | comments 和 public history                   | 高级图表         | API/rules/component tests           |
| PR-8 | Profile、Activity、points visualization      | 核心正确性返修   | privacy + performance checks        |
| PR-9 | 双模式回归、文档、发布配置                   | 新功能           | full verification matrix            |

每个 PR 必须：

- 主要是新增或局部调整，不大规模删除上游链代码；
- 先补对应回归测试，再完成实现；
- 更新受影响的 API/schema 文档；
- 执行聚焦测试、typecheck 和 diff 检查；
- 明确说明未完成项，不使用“全部完成”代替证据。

## 8. 测试矩阵

### 8.1 Domain unit

- approval below/equal/above threshold；
- 0.5 bps rounding 反例；
- zero denominator；
- abstain turnout；
- safe integer overflow；
- create/change/remove delta；
- corrupted stats；
- precise start/end boundary；
- creation validation。

### 8.2 Repository/service emulator

- atomic create/index/stats；
- concurrent index allocation；
- list ordering/filter/pagination；
- Timestamp serialization；
- user profile/balance authority；
- create/change/remove vote；
- simultaneous votes；
- same-user transaction retry；
- fresh votes recomputation equals stats。

### 8.3 API integration

- anonymous 401；
- malformed 400；
- insufficient balance 403；
- missing 404；
- closed/outside window 409；
- infra failure 500；
- body identity spoof ignored；
- stable response shape；
- public vote privacy；
- filters and pagination。

### 8.4 Lifecycle

- future Submitted；
- exact start；
- expired Submitted；
- exact end；
- Confirmed/Rejected；
- Cancelled；
- idempotent retry；
- batch continuation；
- concurrent vote/finalize；
- structured error reporting。

### 8.5 Rules

- complete get/list/create/update/delete matrix；
- owner/non-owner/anonymous/admin；
- UID and role escalation；
- moderation field mutation；
- schema pollution；
- type/size/required fields；
- vote/stats/counter direct write；
- other vote read/query；
- public/private user separation；
- valid application queries still succeed。

### 8.6 Component/provider

- feature flag provider；
- list filters/pagination/create refresh；
- detail 404/error；
- auth loading/anonymous/login/logout/switch user；
- balance/max/three decisions；
- invalid input/server errors；
- existing vote edit/remove；
- realtime listener lifecycle；
- admin cancel；
- no chain-only controls in Points mode。

### 8.7 Chain regression

- original listing/detail；
- metadata；
- wallet selector；
- DOT formatter；
- conviction controls；
- transaction service invocation；
- no Firebase vote request。

## 9. 验证命令基线

实现过程中应根据新增测试配置调整命令，但最终至少执行：

```bash
yarn test
yarn tsc --noEmit
(cd functions && npm run build)
yarn test:rules
yarn test:emulators
yarn prettier --check --ignore-path .gitignore .
git diff --check
```

无链构建：

```bash
ENABLE_BLOCKCHAIN=false \
NEXT_PUBLIC_ENABLE_BLOCKCHAIN=false \
ENABLE_INDEXERS=false \
ENABLE_REDIS=false \
ENABLE_ALGOLIA=false \
ENABLE_AI=false \
IS_CACHE_ENABLED=false \
IS_AI_ENABLED=false \
IS_NOTIFICATION_SERVICE_ENABLED=false \
yarn build
```

链模式构建和回归使用测试环境配置执行，不得连接生产写路径。

## 10. 进度追踪清单

### P0

- [x] 稳定 API 和错误合同已锁定；
- [x] Public vote DTO 不含 UID/余额/PII；
- [x] posts/comments/users/referenda rules 攻击测试通过；
- [x] 生产 stats delta 被直接测试；
- [x] pointsBalance/user document 严格验证；
- [x] 精确投票时间边界已修复；
- [x] outcome 使用精确判定；
- [x] 创建初始状态在同一事务中决定；
- [x] lifecycle index 完整；
- [x] 投票、index、生命周期并发测试通过；
- [x] `test:emulators` 真正运行非 rules 测试。

### P1

- [x] points client service 已建立；
- [x] 列表/详情使用 server initial data；
- [x] stats 只有单一 realtime listener；
- [x] auth/logout/switch user 状态正确；
- [x] 列表筛选、指标和错误状态完整；
- [x] 详情周期、门槛、标签、历史完整；
- [x] 投票 balance/max/inline error/success 完整；
- [x] 管理员取消 UI 完整；
- [ ] comments 和安全 public history 完整；
- [ ] 本地化和可访问性达到验收要求；
- [ ] chain/demo 回归通过；
- [ ] 文档与实现一致。

### P2

- [ ] Profile Referenda vote history；
- [ ] Activity Feed；
- [ ] points-native bubble/history；
- [ ] read-cost/performance audit；
- [ ] 高级 observability 和运营面板。

## 11. 完成定义

Points Referenda 只有在以下条件全部满足后才能标记 Complete：

1. 主流程在 Firebase Emulator Suite 中可重复通过；
2. vote/stats 在创建、改票、撤票和并发下保持一致；
3. lifecycle 在精确时间边界上确定、幂等并可测试；
4. 公开 API 不泄露 UID、余额或 PII；
5. rules 通过完整 allow/deny 和攻击矩阵；
6. 列表、详情、投票和管理员主交互完成；
7. Points 页面不显示伪链概念、不初始化链依赖；
8. Chain 页面保留原钱包、DOT、conviction 和交易行为；
9. no-chain 和 chain 构建/回归都有实际记录；
10. README、架构、开发、no-keys、API/schema 文档全部与实现一致；
11. 生产 Firestore edition、indexes、rules、发布顺序和回滚方案已确认；
12. 所有 P0/P1 清单已关闭且有测试或验收证据。

## 12. 下一步建议

下一步直接从 **PR-1：合同、Public DTO、API shape 和测试配置** 开始，随后执行 **PR-2：安全规则与隐私**；在这两项完成前，不建议继续扩展 Referenda UI。

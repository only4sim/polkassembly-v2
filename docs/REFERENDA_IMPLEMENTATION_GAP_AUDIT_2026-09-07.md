# Referenda 模块实现差距审计报告

> 审计日期：2026-09-07  
> 审计版本：`afb381db`（`main`）  
> 审计对象：链模式 Referenda 与 `ENABLE_BLOCKCHAIN=false` 下的 Firebase/Points Referenda  
> 报告用途：为后续修复、产品确认、任务拆分和验收提供基线

## 1. 结论摘要

当前链模式 Referenda 页面主体、钱包投票和链上交互代码已通过 provider wrapper 保留，未发现原页面主体被删除或重写。

Firebase/Points Referenda 已经具备可编译的端到端 Alpha 骨架：

- `/referenda` 和 `/referenda/{index}` 已不再在无链模式下重定向首页；
- 已实现列表、详情、创建、本人投票读取、投票、改票、撤票、聚合统计、实时监听；
- 已实现事务化 referendum index 分配、vote/stats 聚合更新；
- 已实现管理员取消 API 和定时生命周期 Function；
- 已提交基础 Firestore rules、indexes 和领域单元测试。

但该里程碑尚未达到 `REFERENDA_POINTS_DEVELOPMENT_GUIDE.md` 的 Definition of Done，不应视为生产完成。主要差距为：

1. 生命周期和最终结果仍有正确性风险；
2. 公开投票历史存在隐私字段暴露；
3. DemoOS 页面仍是最小 UI，没有达到既有 Referenda 的主要体验奇偶性；
4. 多项后端能力没有 UI 入口或展示；
5. 缺少 API、Repository、事务并发、生命周期、组件和双模式回归测试；
6. README、架构和 no-keys 文档仍将该功能描述为 upcoming/next milestone。

综合判断：**Points Referenda 当前处于“后端骨架基本建立、最小 UI 已接通、尚需完整修复和验收”的阶段。**

## 2. 审计范围与判断方式

本次检查覆盖：

- Referenda 路由和 feature flag provider；
- DemoOS 列表、详情、创建、投票和实时统计组件；
- `/api/v2/referenda` API 族；
- Referendum domain entities、DTO、validation 和 outcome；
- Firestore Repository、mapper、rules 和 indexes；
- `finalizeReferenda` Cloud Function；
- Referenda 相关测试、构建脚本和产品/修复文档；
- 现有链模式 Referenda 页面是否得到保留。

分类标准：

- **部分实现、尚未完成**：已有可运行代码，但合同、正确性、体验或测试仍有缺口；
- **功能已实现、UI 未展示**：已有后端 API、数据字段或服务能力，但当前页面不可见或不可操作；
- **计划实现、尚未实现**：开发/修复指南明确要求，但仓库中没有对应实现或只有概念性文档。

## 3. 已部分实现，但尚未完成

### 3.1 Chain/DemoOS provider 分流

已实现：

- `src/app/(listing)/referenda/page.tsx` 根据 `ENABLE_BLOCKCHAIN` 动态加载 `ReferendaChainPage` 或 `DemoReferendaPage`；
- `src/app/referenda/[index]/page.tsx` 对详情页执行同样分流；
- 无链侧边栏包含 `/referenda`；
- 原链模式列表和详情主体已分别保存在 `ReferendaChainPage.tsx`、`ReferendaChainDetail.tsx`。

未完成：

- 没有自动测试证明两个 flag 值选择正确 provider；
- 没有链模式钱包、DOT、conviction、交易提交回归测试；
- DemoOS 页面没有 server initial data，首屏完全依赖浏览器 fetch。

证据：

- `src/app/(listing)/referenda/page.tsx:19-26`
- `src/app/referenda/[index]/page.tsx:20-32`
- `src/_shared/_constants/sidebarConstant.ts:63-81`

### 3.2 Referenda 列表

已实现：

- Firestore Repository 支持倒序列表、分页、状态过滤和总数统计；
- API 支持 `page`、`pageSize`、`status`；
- Demo 页面有加载、空列表、翻页、卡片导航和创建按钮。

未完成：

- Demo 页面只请求 `page/pageSize`，没有状态、origin 或标签筛选控件；
- provider 没有把 URL `searchParams` 传给 Demo 页面；
- API 没有实现开发指南定义的 `origin` 过滤；
- 页面重新实现了最小列表，没有复用 `ListingPage`、`ListingTab`、`ListingCard`；
- 卡片没有投票指标、评论数、投票结束时间或标签；
- fetch 失败被转成空数组，用户会看到“No referenda yet”，无法区分服务错误和真实空列表；
- 在第一页创建成功时调用 `setPage(1)` 不会触发状态变化，因此通常不会刷新新数据。

证据：

- `src/adapters/firestore/FirestoreReferendumRepository.ts:33-56`
- `src/app/api/v2/referenda/route.ts:28-47`
- `src/app/(listing)/referenda/DemoReferendaPage.tsx:24-41`
- `src/app/_shared-components/DemoReferenda/DemoReferendaCard.tsx`

### 3.3 Referendum 详情

已实现：

- 展示 index、标题、正文、作者、创建日期、origin 和状态；
- 等待 Firebase auth ready 后读取当前用户投票；
- Deciding 状态下提供 Cast Vote/Change Vote；
- 展示当前用户 decision 和 pointsUsed；
- 接入实时聚合统计组件。

未完成：

- 详情 fetch 没有检查 `response.ok`，404/500 的 `{ message }` 可能被当作 referendum 对象；
- 非数字 index 没有在页面边界处理，会继续请求 `.../NaN`；
- 切换账号或退出登录时没有明确清空旧 `myVote`；
- CTA 只判断持久化状态是否为 `Deciding`，没有同时判断当前时间是否仍在投票窗口；
- 没有展示投票起止时间、approval threshold、minimum turnout、tags、closed time；
- 没有评论、时间线、公开投票历史、错误恢复或既有多栏详情布局；
- 没有复用 `PostHeader`、`PostContent`、`PostComments`、`VoteSummary` 等既有体验。

证据：

- `src/app/referenda/[index]/DemoReferendaDetail.tsx:30-77`
- `src/app/referenda/[index]/DemoReferendaDetail.tsx:87-149`

### 3.4 Points 投票、改票和撤票

已实现：

- 使用 Firebase ID Token 确认 UID；
- 服务端从 `users/{uid}` 读取 `pointsBalance`；
- 支持 Aye、Nay、Abstain；
- 支持 1 到当前余额的安全整数积分；
- vote 文档和 aggregate stats 在同一 Firestore transaction 中更新；
- 支持改 decision、改 points 和撤票；
- 客户端具有 loading 状态和 toast 反馈。

未完成或有风险：

- 未显式要求用户文档存在；缺失用户会被当成余额 0；
- 没有验证 Firestore 中 `pointsBalance` 本身是非负 safe integer；
- 投票使用用户文档 displayName，但缺失时回退 token；创建 referendum 则直接使用 token displayName，与“作者资料来自 Firestore”的合同不完全一致；
- 投票窗口结束判断是 `now > votingEndsAt`，导致 `now === votingEndsAt` 仍可投票或撤票；合同要求半开区间 `startsAt <= now < endsAt`；
- stats delta 是 trusted service 私有方法，没有独立、可复用、直接被测试的领域实现；
- `statsDelta.test.ts` 复制了一份同类算法进行测试，不能证明生产服务中的实现正确；
- UI 不加载或显示当前 pointsBalance；
- 没有 Use max；
- 没有非整数、超额、零值的内联校验；
- number input 会把空值和 0 强制回 1，无法呈现所需的零值错误状态；
- 没有成功摘要 modal，也没有投票后评论交互；
- 成功后没有统一刷新 detail、listing、stats、profile history 等缓存。

证据：

- `src/app/api/_api-services/referenda/referendumTrustedService.ts:80-143`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts:146-176`
- `src/domain/services/referendumValidation.ts:51-110`
- `src/domain/services/__tests__/statsDelta.test.ts:11-55`
- `src/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog.tsx`

### 3.5 创建和 index 分配

已实现：

- 创建请求必须携带有效 Firebase Token；
- 校验标题、正文、origin、标签、日期顺序、approval bps 和 minimum turnout；
- index、referendum 文档和空 stats 文档在一个事务中写入；
- 创建 UI 不进入钱包或链 extrinsic 流程。

未完成或有风险：

- 创建总是先写 `Submitted`，随后 API 在另一个事务中调用 `openForVoting`；
- 创建响应使用第一次写入返回的对象，即使数据库随后变成 `Deciding`，响应仍可能返回 `Submitted`；
- 创建与立即开启不是原子操作，中间失败会留下错误状态；
- 没有拒绝已经过期的投票窗口；
- `openForVoting` 没有验证现有状态、开始时间和结束时间；
- counter 字段使用 `value`，与修复指南建议的 `nextIndex` 不一致；
- 默认门槛在组件中硬编码为 5000 bps 和 100 turnout，没有集中配置；开发指南推荐的初始 minimum turnout 是 1；
- 创建表单仅提供 4 个 origin，领域层允许 10 个。

证据：

- `src/app/api/v2/referenda/route.ts:63-84`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts:179-212`
- `src/adapters/firestore/FirestoreReferendumRepository.ts:64-103`
- `src/app/_shared-components/DemoReferenda/DemoCreateReferendaDialog.tsx:19-79`

### 3.6 生命周期和最终结果

已实现：

- `finalizeReferenda` 已从 Functions index 导出；
- 每 5 分钟扫描 Submitted 和 Deciding referendum；
- Submitted 到时可转为 Deciding；
- 已过期的 Deciding 根据 stats 和存储门槛转为 Confirmed/Rejected；
- 处理在 transaction 中重读当前文档，具备基本幂等性；
- 顶层错误会重新抛出以触发 retry；
- 管理员可以通过可信 DELETE API 取消未结束 referendum。

未完成或有风险：

- `firestore.indexes.json` 有 `status + votingEndsAt`，但没有 scheduler 开启查询所需的 `status + votingStartsAt` 复合索引；
- Cloud Function 复制了独立的 approval/outcome 算法，没有复用或严格共享领域函数；
- scheduler 和领域层都以四舍五入后的 bps 进行最终判定；例如真实结果为 0.5 bps、门槛为 1 bps 时，可能被错误判定通过；
- scheduler 的 lifecycle 转换没有 emulator/integration 测试；
- 当前 `test:emulators` 没有启动 Pub/Sub emulator，执行输出显示 scheduled Function 被忽略；
- 每批最多 100 条，没有测试积压、多批处理和单条失败的行为；
- 管理员取消能力没有 UI；force-close 和生命周期编辑没有 API/UI。

证据：

- `functions/src/finalizeReferenda.ts`
- `functions/src/index.ts:340`
- `src/domain/entities/ReferendumStats.ts:39-42`
- `src/domain/services/referendumOutcome.ts:27-42`
- `firestore.indexes.json`

### 3.7 实时统计

已实现：

- 监听单个 `referenda/{index}/stats/current`，没有监听整个 votes collection；
- unmount 时取消订阅；
- 展示 Aye/Nay/Abstain points、总投票人数、approval 和 turnout；
- 监听错误有可见 fallback。

未完成或有风险：

- 组件挂载后同时发起 HTTP fetch 和 Firestore `onSnapshot`；如果实时快照先返回，较旧 HTTP 数据可能随后覆盖它；
- HTTP fetch 不检查 `response.ok`；
- 没有使用 server initial stats 做 SSR/hydration；
- snapshot mapper 将 `approvalBps` 和 `participatingPoints` 固定为 0，再由 JSX 重新计算，形成重复语义；
- 没有显示每个 decision 的 voter count 和 stats 更新时间。

证据：

- `src/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx:20-58`
- `src/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx:68-137`

### 3.8 API 合同和错误语义

已实现：

- 已建立集中式 `referendaErrorResponse`；
- 已映射 400、401、403、404、409；
- 创建、投票和取消均使用可信服务；
- API 不从请求 body 接收 UID、role 或 balance。

未完成或有风险：

- API 返回形状与开发/修复指南不一致：
  - own vote GET 返回裸 vote/null，而不是 `{ vote }`；
  - PUT 返回 `{ data, stats }`，而不是 `{ vote, stats }`；
  - DELETE 返回 `{ message }`，而不是 `{ removed: true, stats? }`；
- list 使用 `pageSize`，开发指南示例使用 `limit`；
- vote history 只有 `limit`，没有 page 和 decision filter；
- `totalCount` 是本次 limit 返回数量，不是真实总数；
- trusted service 把未知错误统一转换成 `conflict`，基础设施错误可能错误地返回 409 而不是 500；
- 没有 route handler 级 API 合同和状态码测试。

证据：

- `src/app/api/_api-utils/referendaErrors.ts`
- `src/app/api/v2/referenda/[index]/votes/me/route.ts`
- `src/app/api/v2/referenda/[index]/votes/route.ts`

### 3.9 Firestore 安全规则

已实现：

- referendum 文档允许公开读、拒绝客户端写；
- stats 允许公开读、拒绝客户端写；
- vote 仅允许登录用户读取自己的 UID 文档，拒绝客户端写；
- user 文档拒绝客户端写；
- 当前 13 个 rules 测试通过。

未完成或有风险：

- `posts/{postId}` update 只检查旧文档 authorUid，没有字段白名单；原作者可以直接修改 `status`、`isPinned`、`authorUid` 等字段；
- comment update 同样没有阻止修改 authorUid 或其他受保护字段；
- post/comment create 没有验证请求 authorUid 与当前用户一致；
- counters 被公开读取，未证明有客户端需求；
- rules 测试没有覆盖 posts/comments、字段提权、collection query、counter 和匿名 vote 写等完整矩阵。

这些问题不完全属于 Referenda 数据本身，但它们由当前同一规则文件控制，是 Referenda 里程碑的部署阻断项。

证据：

- `firestore.rules:6-76`
- `tests/firestore/rules.test.ts`

## 4. 已实现，但当前 UI 没有展示或入口

| 已有能力                                  | 实现位置                           | 当前 UI 状态                       | 后续处理建议                             |
| ----------------------------------------- | ---------------------------------- | ---------------------------------- | ---------------------------------------- |
| 状态过滤                                  | list API + Firestore Repository    | Demo 列表没有筛选器，也不传 status | 接入 URL search params 和现有筛选外壳    |
| 管理员取消                                | `DELETE /api/v2/referenda/{index}` | 没有管理员取消按钮                 | 在详情 capabilities/admin actions 中接入 |
| 公开投票历史                              | `GET .../{index}/votes`            | 详情页从不调用                     | 先修复隐私 DTO，再展示历史               |
| tags                                      | Referendum DTO/Firestore           | 列表和详情均不展示                 | 在 header/content metadata 中展示        |
| votingStartsAt/votingEndsAt               | Referendum DTO/Firestore           | 创建时填写，但详情和列表不展示     | 增加投票期、倒计时和关闭状态             |
| approvalThresholdBps/minimumTurnoutPoints | Referendum DTO/Firestore           | 创建时填写，结果页不展示门槛       | 在结果摘要中显示门槛和是否达标           |
| aye/nay/abstain voter counts              | Stats DTO/Firestore                | 只显示 totalVoters                 | 在结果和历史区域展示分项人数             |
| stats updatedAt                           | Stats DTO                          | 未展示                             | 可用于“最后更新”或调试信息               |
| voterDisplayName                          | Own/public vote DTO                | 本人投票卡仅显示 decision/points   | 成功摘要和历史 UI 可使用                 |
| balanceAtVote                             | Own/public vote DTO                | 未展示                             | 应保留为本人/审计字段，不应公开展示      |
| 额外 6 个 origin                          | Domain allowlist                   | 创建表单仅有 4 个                  | 产品确认后补全或缩小服务端 allowlist     |

### 4.1 有意只在链模式展示的既有能力

以下功能在仓库中已经存在，但在 DemoOS/Points Referenda 中隐藏是明确的产品决定，不应当作当前缺陷：

- wallet/address 选择；
- DOT 金额和 USD 换算；
- conviction 和 lock period；
- split/split-abstain；
- delegation 和 delegated voting power；
- decision deposit、refund、preimage、enactment、beneficiary payout；
- 链上 approval/support curves；
- Referendum Canceller/Killer 链上 extrinsic 页面；
- 链数据驱动的 governance analytics。

## 5. 计划实现但尚未实现

### 5.1 当前 Points Referenda 里程碑内

以下项目由开发指南或修复指南明确要求，但当前没有完整实现：

1. `points_referenda_client_service`：统一 URL、token、错误和 DTO 解析；
2. Points 专用 React Query keys 和 mutation 后 cache invalidation；
3. 列表、详情、stats、public history 的 server initial data；
4. normalized view model 和 `ReferendumCapabilities`；
5. 复用现有 ListingPage/ListingCard/PostDetails/ChooseVote/VoteSummary 外壳；
6. Referendum 评论和投票后评论；
7. 安全的公开投票历史 UI；
8. points-native bubble/history visualization；
9. Profile Referenda vote history；
10. Activity Feed 中的 referendum 创建、投票和结算活动；
11. API origin/tag filter、vote history pagination/decision filter；
12. 专用 `PublicReferendumVoteDto`，移除 UID、balance 和私有资料；
13. 管理员 force-close 和受控生命周期编辑；
14. API、Repository、service、并发、scheduler、组件和 E2E 测试；
15. chain/demo provider、metadata、钱包投票路径回归测试；
16. 完整本地化、键盘操作、ARIA、响应式和错误恢复；
17. Firestore read-cost、性能和分页策略审计；
18. 最终 schema、API、emulator、部署和已知限制文档。

### 5.2 明确不属于首版，仅为潜在后续

开发指南将以下能力明确列为 first release out of scope。除非产品重新批准，不建议在当前修复阶段实现：

- DOT 或其他可转移 token；
- conviction multiplier 和 lock；
- delegation；
- split/split-abstain；
- wallet/address 投票身份；
- deposit、preimage、enactment、treasury payout、refund；
- 链派生 approval/support curves；
- 跨网络 points balance；
- notifications/subscriptions。

## 6. 最高优先级阻断问题

### P0-1：公开投票历史泄露 UID 和余额快照

`GET /api/v2/referenda/{index}/votes` 使用 Admin SDK 读取所有 vote，并通过完整 `ReferendumVoteDto` 返回：

- Firebase UID；
- voter display name；
- decision；
- pointsUsed；
- balanceAtVote；
- 时间字段。

这绕过了 Firestore“只能读取本人 vote”的客户端规则。应建立独立 Public DTO，至少移除 UID 和 `balanceAtVote`，并增加隐私合同测试。

### P0-2：最终门槛判定使用四舍五入值

领域层和 Cloud Function 都使用：

```text
Math.round(aye / (aye + nay) * 10000)
```

随后直接与门槛比较。这会把实际略低于门槛的结果向上取整。最终判定应使用 safe integer 校验后的 BigInt 交叉相乘；rounded bps 只能用于显示。

### P0-3：生命周期开启查询缺少索引且没有真实测试

Function 查询 `status == Submitted` 且 `votingStartsAt <= now`，但 indexes 文件没有 `status + votingStartsAt`。当前 emulator 测试没有执行 scheduler，因此无法发现该问题。

### P0-4：创建和立即开启不是原子状态决定

创建先提交 Submitted，再独立更新 Deciding。应在创建事务中根据同一个 server `now` 直接决定初始状态，并拒绝已过期窗口。

### P0-5：Firestore posts/comments 规则仍允许修改受保护字段

即使 Referenda 规则本身较严格，当前 rules 文件仍允许内容作者直接改变 moderation/ownership 字段。Referenda rules 不应以破坏已有安全边界为代价部署。

### P0-6：没有证明事务和生命周期在并发下正确

当前没有投票 create/change/remove 的 emulator service 测试、并发投票测试、并发 index 测试或投票与 finalization 竞态测试。

## 7. 建议的下一步实施顺序

### 阶段 A：正确性、安全和稳定合同

1. 引入 `PublicReferendumVoteDto`，修复公开历史隐私；
2. 固定所有 API response shape 和错误码；
3. 提取生产使用的纯 stats delta 函数并直接测试；
4. 严格验证用户文档和 pointsBalance；
5. 修复投票结束边界；
6. 使用精确交叉相乘进行最终门槛判定；
7. 修复 posts/comments rules 字段白名单；
8. 增加缺失的 lifecycle composite index。

### 阶段 B：事务和生命周期验收

1. 创建事务中原子决定 Submitted/Deciding；
2. 拒绝已过期的创建窗口；
3. 统一 domain 与 Functions outcome 算法；
4. 增加 Repository/service/API emulator 测试；
5. 增加投票、index、结算并发测试；
6. 增加可注入时钟的生命周期边界测试。

### 阶段 C：数据加载和客户端状态

1. 新建统一 points Referenda client service；
2. 列表和详情改为 server initial data；
3. stats 只保留一个 realtime listener，移除双源竞态；
4. 正确处理 auth loading、登出、切换账号、401/404/409；
5. 创建/投票后统一刷新相关页面和缓存。

### 阶段 D：UI 完整化

1. 接入现有列表筛选、卡片和响应式布局；
2. 展示周期、门槛、标签、投票指标；
3. 投票对话框增加 balance、Use max、内联错误和成功摘要；
4. 增加 comments 和安全的 vote history；
5. 增加管理员取消入口；
6. 完成本地化和可访问性。

### 阶段 E：回归、文档和上线门禁

1. 增加两种 feature flag 的 provider/metadata/主流程回归测试；
2. 验证链模式钱包、DOT、conviction 和 extrinsic 路径；
3. 运行 no-chain no-keys build；
4. 更新 README、ARCHITECTURE、DEV_NO_KEYS 和 API/schema 文档；
5. 完整执行 Definition of Done 后再将里程碑标记完成。

## 8. 本次实际验证结果

| 检查                            | 结果               | 说明                                                                   |
| ------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `git status --short`            | 通过               | 审计开始和结束时工作区均 clean                                         |
| `yarn test`                     | 通过               | 4 个文件，52 个测试；主要为 domain/DTO 单元测试                        |
| `yarn tsc --noEmit`             | 通过               | 根项目 TypeScript 检查通过                                             |
| `cd functions && npm run build` | 通过               | Functions TypeScript 编译通过                                          |
| `yarn test:rules`               | 通过               | 1 个文件，13 个规则测试                                                |
| `yarn test:emulators`           | 命令通过但覆盖不足 | 实际只运行 13 个 rules 测试；scheduler 因无 Pub/Sub emulator 被忽略    |
| 无链生产构建                    | 通过               | 所有 blockchain/indexer/cache/AI flag 关闭；存在仓库已有 lint warnings |

无链构建使用的关键覆盖值：

```text
ENABLE_BLOCKCHAIN=false
NEXT_PUBLIC_ENABLE_BLOCKCHAIN=false
ENABLE_INDEXERS=false
ENABLE_REDIS=false
ENABLE_ALGOLIA=false
ENABLE_AI=false
IS_CACHE_ENABLED=false
IS_AI_ENABLED=false
IS_NOTIFICATION_SERVICE_ENABLED=false
```

本次没有执行、因此不能声称通过：

- 实际浏览器 E2E；
- 投票 API integration；
- Firestore Repository/service 集成；
- 并发投票和并发 index；
- lifecycle scheduler；
- 实时监听组件交互；
- chain-enabled 生产构建和链上交易回归。

## 9. 关键文件索引

### 路由和页面

- `src/app/(listing)/referenda/page.tsx`
- `src/app/(listing)/referenda/DemoReferendaPage.tsx`
- `src/app/(listing)/referenda/ReferendaChainPage.tsx`
- `src/app/referenda/[index]/page.tsx`
- `src/app/referenda/[index]/DemoReferendaDetail.tsx`
- `src/app/referenda/[index]/ReferendaChainDetail.tsx`

### Demo UI

- `src/app/_shared-components/DemoReferenda/DemoReferendaCard.tsx`
- `src/app/_shared-components/DemoReferenda/DemoCreateReferendaDialog.tsx`
- `src/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog.tsx`
- `src/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx`

### API 和服务

- `src/app/api/v2/referenda/route.ts`
- `src/app/api/v2/referenda/[index]/route.ts`
- `src/app/api/v2/referenda/[index]/stats/route.ts`
- `src/app/api/v2/referenda/[index]/votes/route.ts`
- `src/app/api/v2/referenda/[index]/votes/me/route.ts`
- `src/app/api/_api-services/referenda/referendumReadService.ts`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts`
- `src/app/api/_api-utils/referendaAuth.ts`
- `src/app/api/_api-utils/referendaErrors.ts`

### Domain、Firestore 和 Functions

- `src/domain/entities/Referendum.ts`
- `src/domain/entities/ReferendumVote.ts`
- `src/domain/entities/ReferendumStats.ts`
- `src/domain/dtos/ReferendaDtos.ts`
- `src/domain/services/referendumValidation.ts`
- `src/domain/services/referendumOutcome.ts`
- `src/adapters/firestore/FirestoreReferendumRepository.ts`
- `src/adapters/firestore/referendaMappers.ts`
- `functions/src/finalizeReferenda.ts`
- `firestore.rules`
- `firestore.indexes.json`

### 规格和既有审阅

- `docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`
- `docs/REFERENDA_POINTS_REVIEW_REPORT.md`
- `docs/REFERENDA_POINTS_REPAIR_GUIDE.md`

## 10. 建议的里程碑状态

在项目跟踪中，建议将 Points-based Referenda 标记为：

```text
🟨 Alpha / Partially implemented
```

而不是：

```text
✅ Complete / Production ready
```

完成第 6 节全部 P0 项、补齐核心 emulator/API/并发测试，并完成投票、列表、详情的主要 UI 合同后，再进入 beta/验收阶段。

# Points-based Referenda 开发审阅报告

> 审阅日期：2026-08-23  
> 审阅范围：当前未提交工作区，对照 `REFERENDA_POINTS_AGENT_PROMPT.md` 和
> `REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`  
> 结论：**不建议合并或部署**。实现已建立基本分层和读写骨架，但投票错误语义、生命周期、详情页鉴权、规则安全和验收测试仍有阻断性问题。

## 1. 总体评价

已完成的有价值基础：

- 保留了链模式页面主体，并在页面边界使用动态导入分流。
- 新增了无 Firebase/React/Polkadot 依赖的 Referendum/Vote/Stats 领域类型、验证函数和 DTO。
- 提供了显式 `/api/v2/referenda` API 族、Firestore 仓储、可信投票事务、创建和管理员取消路径。
- 投票事务将 referendum/user/vote/stats 读取放在写入之前，并在同一事务中更新 vote 和 stats。
- 已提交 Firestore rules/indexes，并有基础规则测试。
- 无链生产构建、TypeScript 检查、Functions 构建和现有单元测试可通过。

但当前更接近“端到端骨架 + 最小界面”，未达到文档中的 Definition of Done，也尚未证明投票聚合在并发下保持一致。

## 2. 阻断性问题

### P0-1：合法的业务拒绝被 API 错误返回为 500

`validateVoteInput` / `assertRemovalAllowed` 抛出 `VoteValidationError`，
`validateCreationInput` 抛出 `CreationValidationError`；但
`referendaErrorResponse` 只识别 `ReferendaServiceError`。因此以下情况都会落入通用 500，
而不是合同要求的 400/403/409：

- 非法 decision/points、超额积分；
- Submitted/已关闭/已过期投票与撤票；
- 创建时非法标题、origin、日期、门槛。

证据：
`src/app/api/_api-utils/referendaErrors.ts:13-30`、
`src/app/api/_api-services/referenda/referendumTrustedService.ts:87-97,161,187-191`。

修改建议：在 API 边界显式映射两种领域错误，或者在 trusted service 中统一翻译为
`ReferendaServiceError`；增加真正调用 route handler 的 API 测试，固定每个状态码。

### P0-2：生命周期不完整，未来开始的 referendum 永远不会进入 Deciding

创建只在 `votingStartsAt <= Date.now()` 时立即调用 `openForVoting`。定时 Function 只查询已是
`Deciding` 且过期的文档，没有任何路径将之前创建的 `Submitted` 文档在开始时刻转成
`Deciding`。这会使正常的未来投票窗口永久不可投票。

同时，Next.js 侧的 `finalizeExpiredReferenda` 对 `Deciding` 记录调用 `decideOutcome`，但后者明确对
`Deciding` 抛错，该服务方法必然失败。当前 Cloud Function 又复制了一份不同的结果算法，造成两套业务规则。

证据：
`src/app/api/v2/referenda/route.ts:72-75`、
`src/app/api/_api-services/referenda/referendumTrustedService.ts:209-219,240-269`、
`src/domain/services/referendumOutcome.ts:28-32`、
`functions/src/finalizeReferenda.ts`。

修改建议：用一个定时生命周期处理器同时完成
`Submitted -> Deciding` 和 `Deciding -> Confirmed/Rejected`；让结果函数接受“投票窗口已结束的
Deciding”作为输入，Functions 与 Next.js 共享或严格对齐同一组经测试的纯函数。

### P0-3：详情页的“当前用户投票”请求没有鉴权，并将 401 错误体当成投票

`GET /votes/me` 必须带 Firebase ID Token，但详情页直接无头请求，也不检查
`response.ok`。API 的 `{ message: "You must be logged in." }` 会被设置到 `myVote`，结果是：

- 匿名用户会看到“Change Vote”和内容为 `undefined` 的“Your Vote”；
- 已登录用户也无法加载已有投票；
- 错误的 `existingVote` 还会开启“Remove Vote”路径。

证据：`src/app/referenda/[index]/DemoReferendaDetail.tsx:29-40,75-103`。

修改建议：使用现有 Firebase auth hook 等待 auth ready，仅对已登录用户获取 token 后请求；
匿名状态显示现有登录 gate；检查 HTTP 状态并只接受 `{ vote: ... }` 或明确的
`null` 合同。

### P0-4：新 Firestore 规则使任意登录用户可修改任意 post

`allow update: if request.auth != null` 允许任意登录用户直接修改任意 post，包括
`status`、`isPinned`、`authorUid` 等字段，违反 `docs/AGENTS.md` 中“moderation 必须经过可信服务”的硬约束。
评论 update 只检查新数据的 `authorUid`，攻击者可将它改为自己从而篡改他人评论；delete
使用了删除时不存在的 `request.resource.data`。现有规则测试没有覆盖这些路径。

证据：`firestore.rules:50-61`。

修改建议：在并入 referenda 规则前先保留/恢复现有 posts/comments 的严格策略；使用
`resource.data.authorUid` 校验现有所有者，限制可变字段，并将 pin/lock/hide 继续限制在管理员可信路径。
添加“修改他人 post/comment”、“自行提权为 author/admin”、“非管理员 moderation”拒绝测试。

## 3. 高优先级问题

### P1-1：投票界面未实现必要产品合同

当前对话框没有加载或显示 `pointsBalance`，没有“Use max”，没有超额/非整数内联校验，
也没有复用现有登录 gate、ChooseVote、成功弹窗和投票后评论交互。number input 会把空值和
0 强制改成 1，无法展示要求的零值错误。

证据：`src/app/_shared-components/DemoReferenda/DemoReferendaVoteDialog.tsx:23-166`。

### P1-2：列表/详情远未达到“现有 Referenda 视觉和主交互奇偶性”

实现新写了一套最小卡片和详情页，未复用指南指定的 `ListingPage`/`ListingTab`/`ListingCard`、
`PostHeader`/`PostContent`/`PostComments`、VoteSummary/投票历史。缺少 status/origin 过滤、评论、时间线、投票历史、
列表投票指标、错误态与大量本地化。因此“接近原 Referenda 体验”这一核心验收项未达成。

证据：
`src/app/(listing)/referenda/DemoReferendaPage.tsx`、
`src/app/_shared-components/DemoReferenda/DemoReferendaCard.tsx`、
`src/app/referenda/[index]/DemoReferendaDetail.tsx`。

### P1-3：实时 stats 不是 SSR 初始数据，并存在旧 HTTP 数据覆盖新快照的竞态

详情页完全客户端获取；stats 组件挂载后同时启动 HTTP fetch 和 `onSnapshot`。如果快照先到、HTTP
后到，较旧的 HTTP 响应会覆盖实时数据。快照映射还把 `approvalBps` 和 `participatingPoints`
硬编码为 0，初始 fetch 也不检查 `response.ok`。

证据：`src/app/_shared-components/DemoReferenda/DemoReferendaRealtimeStats.tsx:18-64`。

修改建议：在 server page 获取 detail + initial stats 并作为 props 传入，客户端仅建立一个 stats doc
监听；快照统一使用纯 DTO mapper 计算派生字段。

### P1-4：公开投票历史 API 绕过了 own-vote 隐私规则

Firestore 规则只允许读取自己的 vote，但未鉴权的
`GET /api/v2/referenda/{index}/votes` 通过 Admin SDK 返回所有用户的 `uid`、显示名、投票方向、
`pointsUsed` 和 `balanceAtVote`。其中 balance 快照尤其不应在未明确产品决策时公开。

证据：
`firestore.rules:33-39`、
`src/app/api/v2/referenda/[index]/votes/route.ts`、
`src/domain/dtos/ReferendaDtos.ts:45-53,108-120`。

修改建议：先决定“公开历史”还是“私密个人投票”。若公开，定义专用 public DTO，至少移除
`uid` 和 `balanceAtVote`，并补充隐私合同和测试；若私密，删除公开历史 API/UI。

### P1-5：结果门槛判定使用四舍五入，可将实际未达标的 referendum 判为通过

`approvalBps` 使用 `Math.round`。例如 aye=1、nay=19999 时实际批准率是 0.5 bps，会被四舍五入为
1 bps；当 threshold=1 时会错误通过。

证据：`src/domain/entities/ReferendumStats.ts:39-42`。

修改建议：最终判定使用整数交叉相乘
`ayePoints * 10000 >= thresholdBps * (ayePoints + nayPoints)`，同时考虑乘法的安全整数上限；
显示用 bps 可以单独取整。增加刚好低于门槛的边界测试。

### P1-6：投票聚合的损坏检测会静默吞掉不一致

`subtractFrom` 使用 `Math.max(0, ...)` 将负值截断为 0。合同要求是“防止负计数”，而非在 stats
已损坏或缺失时静默修复一部分字段。例如 vote 存在但 stats 缺失时，变更投票会生成与 votes
全量聚合不等的 stats。同时未验证用户 `pointsBalance` 和现有 stats 是安全非负整数，累加也可越过
`Number.MAX_SAFE_INTEGER`。

证据：`src/app/api/_api-services/referenda/referendumTrustedService.ts:84,99-102,302-327`。

修改建议：事务中校验所有权威数字和 delta 后数值；一旦不一致则中止事务并记录告警，
或者提供独立、可审计的全量重建工具，不要在普通投票中静默 clamp。

### P1-7：关键集成测试缺失，并且所声明的 emulator 统一命令不可用

当前 32 个单元测试只覆盖领域校验/DTO/结果函数，13 个规则测试覆盖基础 allow/deny。
未发现任何 repository、API、投票事务、并发、组件、实时监听清理或链模式回归测试。

`yarn test:emulators` 立即失败，因为 `package.json` 指定了不存在的
`--import ./tests/emulator-data`。规则测试也未覆盖指南要求的 anonymous vote write，以及上述
posts/comments 越权路径。

修改建议：优先添加 Firestore emulator 事务/API 测试，包括 create/change amount/change decision/remove、
身份伪造、窗口边界、缺失 stats、多用户并发与事务重试；删除无效 import 参数或提交真实的可重复 seed。

## 4. 中优先级问题

### P2-1：链模式 metadata 回归

原页面的网络感知 OpenGraph metadata 被移到普通子组件文件。Next.js 只会从 route segment 的
`page.tsx`/`layout.tsx` 读取 metadata 导出，不会自动调用动态导入组件的 `generateMetadata`。
因此链模式列表只剩“Referenda”，详情只剩“Referendum”，丢失了原标题、描述、网络 URL 和 OG 图片信息。

证据：
`src/app/(listing)/referenda/page.tsx:7-12`、
`src/app/referenda/[index]/page.tsx:8-13`。

修改建议：保留 route 文件中原 metadata 逻辑的链模式分支，DemoOS 分支再返回 points 原生 metadata。

### P2-2：索引分配与创建不在同一事务

`create()` 先独立调用 `next()` 提交 counter，然后开启第二个事务创建 referendum/stats。这仍能
保证并发下不分配相同 index，但第二步失败会永久消耗 index，不符合“创建时事务性分配”的更强语义。

证据：`src/adapters/firestore/FirestoreReferendumRepository.ts:55-75,88-96`。

修改建议：在同一 Firestore transaction 中读/增 counter、创建 referendum 和 initial stats；添加并发创建与
故障注入测试。并将 counter 字段名与指南的 `nextIndex` 对齐，或在文档明确当前的 `value` 选择。

### P2-3：创建后列表在第 1 页不会刷新，API 返回状态也可能过期

`onCreated` 只调用 `setPage(1)`；当已在第 1 页时 state 不变，`fetchData` 不会再执行。另外 API
在将已开始的 referendum 转为 Deciding 后，仍返回转换前的 Submitted DTO。

证据：
`src/app/(listing)/referenda/DemoReferendaPage.tsx:99-105`、
`src/app/api/v2/referenda/route.ts:67-78`。

### P2-4：列表 API 合同与指南不一致且缺少 origin/filter 支持

指南使用 `limit`、`status`、`origin`；实现使用 `pageSize`，只有 status，UI 也不提供过滤。
带 status 时的 total count 使用 `query.get()` 读取所有匹配文档，而不是 Firestore count aggregation，会造成不必要的读取成本。

### P2-5：文档和配置清理未完成

- README/DEV_NO_KEYS 仍把 points Referenda 写成“upcoming”，没有最终 schema/API/限制/测试命令文档。
- `functions/.env.example` 被改成 `ALGOLIA_APP_ID = '';`，分号会成为 dotenv 值的一部分，建议恢复标准 `KEY=''` 形式。
- `firebase.json`、`firestore.indexes.json`、`skills-lock.json`、`functions/package-lock.json` 包含大量纯格式化噪声，应缩小 diff。
- 新增 `jasmine` 未被任何测试或配置使用，应删除或说明用途。

## 5. 与功能无关的异常工作区改动

当前有 **208 个 SVG** 将有效结尾 `</svg>` 改成了 `</svg>;`。这是无效 XML，与 Referenda 任务无关，
而且显著扩大 PR 范围。例子：`src/_assets/icons/Vote.svg`。

建议：在不丢失用户其他工作的前提下，将这 208 个资源文件从 Referenda PR 中全部排除。同样排除
`.agents/skills/firebase-basics/SKILL.md` 和纯格式化的 `skills-lock.json`，除非它们属于另一个明确任务。

## 6. Definition of Done 覆盖评估

| 验收项                             | 状态           | 评论                                                            |
| ---------------------------------- | -------------- | --------------------------------------------------------------- |
| DemoOS 列表/详情不再重定向         | 部分达成       | 路由已分流，但详情 auth/error 处理有故障                        |
| 接近现有 Referenda UI/交互         | 未达成         | 主要为新写最小 UI，缺少指定复用和多个主要功能                   |
| 创建/变更/撤销加权 Aye/Nay/Abstain | 部分达成       | 服务事务存在，但 API 错误码、当前投票加载和 UI 不完整           |
| 超额/未授权/过期服务端拒绝         | 部分达成       | 校验存在，但返回 500，且无 API 集成证据                         |
| 并发聚合一致性                     | 未证明         | 无 emulator 事务/并发测试，损坏 stats 会被静默 clamp            |
| 实时聚合                           | 部分达成       | 监听正确指向单个 stats doc，但无 SSR seed 且存在竞态            |
| 创建、index、生命周期、结算        | 未达成         | 未来 Submitted 无法进入 Deciding，两套结算逻辑不一致            |
| Rules/indexes 并经测试             | 部分达成       | referenda 基础规则通过，但 posts/comments 出现严重越权回归      |
| 无链无 keys 构建                   | 达成（构建层） | 已实际运行生产构建通过；未证明运行时不初始化 wallet/RPC/indexer |
| 链模式回归                         | 未达成         | 无回归测试，metadata 已发生可见回归                             |
| 最终文档                           | 未达成         | 实现后 schema/API/运行/限制文档未更新                           |

## 7. 建议修改顺序

1. 首先修复 P0-1/P0-2/P0-3/P0-4，将 API 错误合同、生命周期、鉴权和 Firestore 安全边界固定下来。
2. 增加 emulator repository/service/API 集成测试和并发测试，并修复 `yarn test:emulators`。没有这层证据前不应调整 UI 细节。
3. 重构 DemoOS 页面为 server initial data + client interaction，完成 token-aware own vote 、stats listener 和列表刷新。
4. 按 reuse matrix 补齐列表/详情/投票 UI，实现 points balance、max、评论、投票历史和错误/空/加载态。
5. 修复链模式 metadata，并添加两种 feature flag 的回归测试。
6. 更新 README/architecture/dev guide，最后清理 208 个 SVG 和锁文件/配置格式化噪声。

## 8. 已执行验证

| 命令                                  | 结果                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `yarn test`                           | 通过：3 个 test files，32 个 tests                                                         |
| `yarn tsc --noEmit`                   | 通过                                                                                       |
| `cd functions && npm run build`       | 通过                                                                                       |
| `yarn test:rules`                     | 通过：1 个 test file，13 个 tests                                                          |
| 无链、所有可选集成关闭的 `yarn build` | 通过；存在仓库原有 lint warnings                                                           |
| `yarn test:emulators`                 | **失败**：`tests/emulator-data` 不存在                                                     |
| 针对改动文件的 Prettier check         | **未通过**：JSON 格式问题；命令还将 Firestore rules 当作 JS 解析，该部分不作为代码失败证据 |

未执行/无法声称通过：投票 API 集成、Firestore 事务并发、组件交互、实时监听、链模式功能回归、
实际浏览器端到端流程。

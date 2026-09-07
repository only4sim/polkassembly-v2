# Points-based Referenda 详细修复指南

> 状态：针对 2026-08-23 审阅结果的执行指南  
> 适用范围：当前 Firebase/points Referenda 未提交实现  
> 权威优先级：用户最新指令 > `REFERENDA_POINTS_DEVELOPMENT_GUIDE.md` > 本指南 > 审阅报告

本指南用于将当前“可构建的功能骨架”修复到可验收状态。它不是新功能规格；
产品规则、数据模型和 Definition of Done 仍以
[`REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`](./REFERENDA_POINTS_DEVELOPMENT_GUIDE.md) 为准。问题证据见
[`REFERENDA_POINTS_REVIEW_REPORT.md`](./REFERENDA_POINTS_REVIEW_REPORT.md)。

## 1. 修复目标

修复完成后：

- `ENABLE_BLOCKCHAIN=false` 时，Referenda 列表、详情、创建、投票、改票、撤票、实时结果和
  生命周期可在 Firebase Emulator Suite 中完整运行。
- 所有投票与生命周期写入都经过已验证的 Firebase 身份和可信服务，客户端不能直写。
- vote 与 stats 在并发创建、改票、撤票和事务重试后仍保持一致。
- `Submitted -> Deciding -> Confirmed | Rejected` 和管理员 `Cancelled` 路径有唯一、可测试的规则。
- DemoOS UI 复用现有 Referenda 的视觉与互动外壳，但不显示 wallet、DOT、conviction、lock、
  delegation、deposit、preimage 等链专有概念。
- `ENABLE_BLOCKCHAIN=true` 时，原有链 Referenda 的 UI、metadata、wallet/DOT/conviction 和交易提交保持不变。
- 规则、API、repository/service、并发、组件、无链构建和链模式回归均有可重复验证。

## 2. 修复原则

### 2.1 保留用户工作和上游代码

- 开始前运行 `git status --short`、`git diff --stat` 和针对目标文件的 `git diff`。
- 当前工作区是 dirty worktree。不要使用 `git reset --hard`、`git checkout --`、广泛 `git restore` 或删除未跟踪文件。
- 208 个 `</svg>;` 改动、skill 文件和锁文件格式化噪声与本修复无关。不要继续修改它们；
  如果没有用户明确授权，也不要擅自恢复。交付时将它们列为应从 Referenda PR 排除的已有改动。
- 修改原 `page.tsx` 时保持 thin provider wrapper；链页面主体留在新的 chain sibling 中，不将 DemoOS
  分支塞入原链组件。
- 修改 `functions/src/index.ts` 时只追加/调整本功能 export，不重写其他 Functions。

### 2.2 一个规则只有一个权威实现

- API route 只做参数解析、鉴权、调用 service 和 HTTP 错误映射。
- 投票窗口、积分、decision、delta 和聚合一致性由 trusted service + 纯领域函数定义。
- 最终结果判定只有一个算法。Cloud Function 可以有自己的 Firestore 适配代码，但不得悄然重新定义门槛规则。
- DTO mapper 负责 HTTP ISO 时间和派生展示值；UI 不重新定义存储语义。

### 2.3 每个阶段先测试后进入下一阶段

每个阶段都必须：

1. 先写出可失败的回归/验收测试。
2. 实现最小完整修复。
3. 运行聚焦测试、TypeScript 和相关 lint/format。
4. 检查 diff 没有无关删除或批量改写。
5. 在计划中标记完成后再进入下一阶段。

## 3. 阶段 0：建立可信基线

### 3.1 必读文件

在修改代码前完整阅读：

1. `docs/AGENTS.md`
2. `docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md`
3. `docs/REFERENDA_POINTS_REVIEW_REPORT.md`
4. 本指南
5. `docs/ARCHITECTURE.md`
6. `docs/DEV_GUIDE.md`
7. `docs/DEV_NO_KEYS.md`
8. `README.md`

然后阅读审阅报告点名的所有实现文件、现有 Firebase auth/user/post/comment 模式和原链
Referenda 组件。

### 3.2 基线命令

记录以下命令的实际结果，不要先修改来历不明的失败：

```bash
git status --short
git diff --stat
yarn test
yarn tsc --noEmit
(cd functions && npm run build)
yarn test:rules
yarn test:emulators
```

已知 `yarn test:emulators` 会因不存在的 `tests/emulator-data` 失败，但 Agent 应重新确认，不可只引用旧报告。

### 3.3 修复测试入口

二选一，优先选择 A：

- A（推荐）：测试自行在 `beforeEach` 通过 rules-disabled/Admin 上下文创建 fixture，从
  `test:emulators` 删除无效 `--import` 参数。
- B：提交真实、小型、可重复的 emulator export 目录，并文档化重建方式。

不要创建空目录来伪装修复。`test:emulators` 必须真正执行 rules + repository/service/API 测试。

阶段门禁：`yarn test:emulators` 能启动所需 emulator、运行至少一个真实测试并正常关闭。

## 4. 阶段 1：修复安全边界与 HTTP 合同

### 4.1 统一业务错误

目标文件：

- `src/domain/services/referendumValidation.ts`
- `src/app/api/_api-services/referenda/referendumTrustedService.ts`
- `src/app/api/_api-utils/referendaErrors.ts`
- `src/app/api/_api-utils/referendaAuth.ts`
- `src/app/api/v2/referenda/**/route.ts`

必须实现的错误映射：

| 情况                                                   | HTTP                                   |
| ------------------------------------------------------ | -------------------------------------- |
| 缺失/无效/过期 Firebase Token                          | 401                                    |
| 非法 decision、非整数/非安全整数、小于 1、非法创建输入 | 400                                    |
| `pointsUsed > pointsBalance`                           | 403                                    |
| 非管理员取消/管理                                      | 403                                    |
| referendum 不存在                                      | 404                                    |
| 非 Deciding、未开始、已过期、已关闭、非法状态转换      | 409                                    |
| 检测到 stats/vote 不一致或服务端约束损坏               | 409 或 500，但必须使用专用错误码并记录 |

建议做法：领域层保留类型化错误，trusted service 在边界将它们转换为统一
`ReferendaServiceError`；`referendaErrorResponse` 映射稳定的 `{ message, code? }` 响应。Firebase Admin
`verifyIdToken` 抛出的 token 错误也必须转成 401，不得落到 500。

不要在每个 route 里复制 `try/catch` 映射表。

### 4.2 固定 API 响应形状

统一为：

```ts
// GET own vote
{ vote: ReferendumVoteDto | null }

// PUT own vote
{ vote: ReferendumVoteDto; stats: ReferendumStatsDto }

// DELETE own vote
{ removed: true; stats?: ReferendumStatsDto }
```

不再在不同 endpoint 中混用裸 `null`、`data`、`vote` 和仅 `message`。日期必须为 ISO string。

### 4.3 修复 Firestore rules

不只检查 referenda，还要保证新 `firestore.rules` 不破坏已有 DemoOS 功能。

必须保证：

- `referenda/{index}`：公开读，客户端所有写拒绝。
- `referenda/{index}/stats/current`：公开读，客户端写拒绝。
- `referenda/{index}/votes/{uid}`：仅已鉴权的本人单文档读，不允许 collection-wide query，所有客户端写拒绝。
- `users/{uid}`：角色和积分不可客户端写。读取范围按已有 UI 的最小需求限制。
- posts/comments：不允许任意已登录用户修改他人内容。使用 `resource.data` 判断现有所有者，
  并用 `diff().affectedKeys()` 或等价白名单防止修改 `authorUid`、moderation 字段和聚合字段。
- delete 规则使用 `resource.data`，不使用不存在的 `request.resource.data`。
- pin/lock/hide 仍是管理员可信写；如现有管理功能未实现，客户端应统一拒绝，不得临时放开。
- counters 没有客户端读取需求，默认应拒绝读写；Admin SDK 不受 rules 影响。

规则测试至少覆盖：

- 匿名和已鉴权直写 vote 均失败。
- 任意客户端写 stats/referendum lifecycle/counter 失败。
- 本人读 vote 成功，他人读和 votes query 失败。
- 修改自己的 `pointsBalance`/`role` 失败。
- 修改/删除他人 post/comment 失败。
- 将他人内容的 authorUid 更改为自己后再修改仍失败。
- 非管理员修改 pin/lock/hide/status 失败。
- 合法的公开 referendum/stats/post/comment 读仍成功。

### 4.4 投票历史隐私

采用保守且不阻塞现有详情体验的默认决策：

- 可保留公开投票历史 endpoint。
- 为它建立独立 `PublicReferendumVoteDto`，只返回产品显示所需的 display name、decision、
  `pointsUsed`、created/updated time。
- 公开 DTO 不得包含 Firebase UID、`balanceAtVote`、email、role 或任何私有 profile 字段。
- own-vote endpoint 可返回完整审计字段给本人。

如果仓库中有更新的明确隐私决策，以它为准并更新文档/测试。

阶段门禁：API 状态码测试、身份伪造测试和完整 rules allow/deny matrix 通过。

## 5. 阶段 2：修复事务、数字和索引正确性

### 5.1 权威用户数据验证

投票事务必须显式要求 `users/{uid}` 存在，并验证：

- `pointsBalance` 是 `Number.isSafeInteger` 的非负整数。
- `displayName` 来自用户文档；如果允许 token fallback，必须文档化并测试。
- 请求 body 中的 uid/displayName/pointsBalance/role/existingVote 都被忽略或拒绝，绝不参与写入。

### 5.2 安全 delta 算法

将聚合变更实现为可单元测试的纯函数，满足：

- create：只增加新 bucket 的 points/voters 和 totalVoters。
- 同 decision 改 amount：减旧 points 加新 points，voter count/totalVoters 保持不变。
- 改 decision：从旧 bucket 减 points 和 1 voter，向新 bucket 加 points 和 1 voter，totalVoters 保持不变。
- remove：只减少旧 bucket 和 totalVoters。
- 相同 PUT：结果幂等，不增加 voter count。
- 任何输入、中间值和结果都是安全非负整数。
- `totalVoters === ayeVoters + nayVoters + abstainVoters`。
- 不使用 `Math.max(0, ...)` 静默 clamp。若 stats 无法减去 existing vote，事务失败并返回专用一致性错误。

stats 缺失时：

- 新 referendum 的首票可在事务中初始化空 stats。
- 如果 existing vote 存在而 stats 缺失，不得猜测聚合；拒绝普通写入并要求通过独立重建/管理路径修复。

### 5.3 严格投票窗口

统一为半开区间：

```text
votingStartsAt <= serverNow < votingEndsAt
```

当 `serverNow === votingEndsAt` 时必须拒绝投票和撤票。修正当前的 `now > votingEndsAt` 判断，并添加开始/结束
精确毫秒边界测试。

### 5.4 精确结果判定

- 存储数字仍统一使用 safe integer `number`。
- 最终门槛判定不使用四舍五入后的 bps。
- 推荐在纯函数内将已校验整数短暂转为 `BigInt()` 交叉相乘：

```ts
BigInt(ayePoints) * 10000n >= BigInt(approvalThresholdBps) * BigInt(ayePoints + nayPoints);
```

如当前 TypeScript target 不允许 bigint literal，使用 `BigInt(10000)` 而不降低精度。零 Aye+Nay 分母的 approval
为 0；abstain 只计 turnout。显示用 `approvalBps` 与通过判定必须分离。

### 5.5 原子创建和 index 分配

在同一 Firestore transaction 中：

1. 读取 `counters/referenda`。
2. 验证 `nextIndex` 是安全非负整数；如文档不存在，从明确的初始值开始。
3. 计算并保存下一个 counter。
4. 创建 `referenda/{index}`。
5. 创建 `referenda/{index}/stats/current`。

所有读在写之前。如任一写失败，counter 不得单独提交。使用指南的 `nextIndex` 字段名；
如必须兼容已有 `value`，添加一次性兼容读取并在文档说明，不要长期混用。

阶段门禁：纯 delta/结果边界测试、emulator 创建/改票/撤票/并发投票/并发 index 测试通过；
每个测试后用 votes 文档新鲜全量汇总与 stats 比较。

## 6. 阶段 3：修复生命周期与定时结算

### 6.1 状态转换表

| 当前状态                     | 条件/动作                                | 下一状态                         |
| ---------------------------- | ---------------------------------------- | -------------------------------- |
| Submitted                    | `startsAt <= now < endsAt`               | Deciding                         |
| Submitted                    | `now >= endsAt` 且从未正常开启           | Rejected（或依权威产品规则结算） |
| Deciding                     | `now < endsAt`                           | Deciding                         |
| Deciding                     | `now >= endsAt` 且 approval/turnout 达标 | Confirmed                        |
| Deciding                     | `now >= endsAt` 且未达标                 | Rejected                         |
| Submitted/Deciding           | 管理员取消                               | Cancelled                        |
| Confirmed/Rejected/Cancelled | 任何再次结算                             | 不变（幂等）                     |

`Submitted` 过期如何处理若与产品决策有冲突，先更新开发指南和测试；不得让它永久停留
Submitted。

### 6.2 单一定时处理器

将 `functions/src/finalizeReferenda.ts` 重构为单一 lifecycle scheduler（可改为更准确的文件/导出名）：

- 处理到期的 Submitted -> Deciding。
- 处理过期的 Deciding -> final outcome。
- 每条记录在 Firestore transaction 中重读 referendum 和 stats，事务内再次验证状态/时间。
- 使用一次捕获的 `now` 作为本次运行的判定时间，写入用 server timestamp。
- 对超过 batch limit 的记录分批处理或确保下次调度可继续；记录 scanned/opened/finalized/skipped/failed 数量。
- 幂等：重试不能二次改变已结束结果。
- 不得在顶层 `catch` 中只 log 后吞掉整个运行的错误；记录后重新抛出，让 Functions retry/monitoring
  看到失败。单条错误的处理策略必须可观测且有测试。

删除或改造 Next.js trusted service 中未使用且必然失败的 `finalizeExpiredReferenda`，避免第二套结算路径。
如为了测试保留纯函数，它不得执行第二套 Firestore 写入。

### 6.3 创建时状态

在创建事务中根据同一 server `now` 设置初始状态：

- `now < startsAt` -> Submitted。
- `startsAt <= now < endsAt` -> Deciding。
- 默认拒绝创建已经过期的窗口，返回 400。

这样不需要创建后的第二个 `openForVoting` 写入，创建 API 返回的 DTO 也不会是过期状态。

阶段门禁：用 emulator 和可注入时钟测试未来开始、精确开始、精确结束、通过、拒绝、取消、
重复调用、并发投票/结算竞态和 scheduler 抛错行为。

## 7. 阶段 4：修复服务器数据、鉴权客户端和实时结果

### 7.1 建立 points Referenda client service

不在组件中散落 raw `fetch`。新增或完善单一 client service，负责：

- 构建稳定 URL/query。
- 已鉴权请求在 auth ready 后从 `clientAuth.currentUser` 获取 ID Token。
- 检查 `response.ok`，将标准 API 错误体转换为类型化客户错误。
- 解析并验证固定 DTO 形状；不将 `{ message }` 当作 vote/detail/stats。
- 提供 list/detail/stats/ownVote/publicVotes/create/upsert/remove 方法。
- 定义 points 专用 React Query keys，不污染链 Referenda cache。

### 7.2 server initial data

- `/referenda` server provider 读取 search params 并获取初始 list DTO，传入 DemoOS client interaction shell。
- `/referenda/{index}` server provider 验证 index，获取 detail + initial stats + public history（如开启）。
- 未找到使用 `notFound()`，服务错误使用现有 server error UI。
- metadata 从 server detail 生成，不在 client effect 后才决定。
- 服务器不使用客户端 Firebase SDK。

own vote 包含客户 Firebase Token，不应由普通 SSR 无 token fetch 伪造。详情客户 shell 应：

1. 使用现有 `useFirebaseAuth` 等待初始化完成。
2. 匿名用户将 own vote 设为 `null`，不请求 protected endpoint。
3. 已登录用户带 token 请求 `{ vote }`。
4. 401 表示会话失效，显示登录态，不创建伪 vote。

### 7.3 实时 stats

- server 传入 `initialStats`，作为首屏和 hydration 数据。
- client 只监听 `referenda/{index}/stats/current`，不同时发起可覆盖快照的竞态 HTTP fetch。
- 快照映射复用统一 mapper，正确计算 approval/participatingPoints，不硬编码 0。
- 缺失 doc 显示空 stats 或明确 fallback；permission/network 错误保留最后一份已知 stats 并显示“实时更新不可用”。
- effect 在 index/db 变化和 unmount 时只调用一次 unsubscribe。
- 投票 API 成功后用响应 stats 立即更新 cache，再由 listener 对齐；不需要监听 votes collection。

### 7.4 创建后刷新

- 创建成功后显式 invalidate/refetch list，不依赖 `setPage(1)` 的 state 变化。
- 如新 referendum 不属于当前 filter，保留 filter 并给出可理解提示。
- 创建 API 返回事务最终状态，不返回过期 Submitted DTO。

阶段门禁：组件/客户 service 测试覆盖 auth loading、匿名、已登录无 vote、已有 vote、401、
404、listener update/error/unsubscribe、创建后第 1 页刷新。

## 8. 阶段 5：补齐 DemoOS UI 与可访问性

### 8.1 列表

优先复用/小幅抽象：

- `ListingPage`、`ListingTab`、`ListingCard` 的页头、tab、filter、pagination、卡片布局与 responsive 行为。
- 为数值格式化添加显式 `votingUnit/formatVotingPower` 策略，points 不经过 DOT/token/USD formatter。
- 支持 status/origin/page/limit 与 URL search params，API 合同和 UI 使用同一名称。
- 隐藏未实现的链 analytics tab，不调用链 analytics API。
- create CTA 已连接 DemoOS trusted flow；匿名用户先进入登录 gate。

### 8.2 详情

复用语义成立的部分：

- PostHeader、PostContent、StatusTag、时间段显示。
- PostComments：如现有 comments 仅支持 posts，为 referenda 建立清晰的 provider/foreign-key 适配，不伪造链 proposal。
- points-native VoteSummary 和经隐私裁剪的投票历史布局。
- Submitted/Deciding/Confirmed/Rejected/Cancelled 状态、投票窗口和最终门槛。

引入一个集中 capabilities 对象，至少包含：

```ts
{
	canVote: boolean;
	canChangeVote: boolean;
	canRemoveVote: boolean;
	showOnChainInfo: boolean;
	showDeposits: boolean;
	showCurveGraph: boolean;
	showPointStats: boolean;
	showVoteHistory: boolean;
}
```

DemoOS 不渲染 wallet/address、DOT/USD、conviction/lock、delegation、deposit/refund、beneficiary/payout、
preimage/enactment、OpenGov curves 或链 tracker。

### 8.3 投票对话框

必须包含：

- Firebase login gate，未登录时不展示可提交的伪表单。
- 当前 `pointsBalance`。
- 仅 Aye/Nay/Abstain，优先复用受限制的 ChooseVote 外观。
- 保留输入原始字符串以显示空值、0、小数、负数和超额错误；不在 `onChange` 中强制改成 1。
- `Use max` 将值设为当前余额。
- 已有 vote 的编辑预填充和 remove 操作。
- submit/remove 分别的 loading 和防重复点击；操作中关闭行为明确。
- stale balance/closed window 等服务端错误在表单内可见，不只是短暂 toast。
- 成功摘要只显示 decision、points、Firebase display name，可接续评论交互。
- 成功后更新 own vote/stats，并 invalidate detail/list/profile points vote history 的独立 keys。

### 8.4 本地化和可访问性

- 将所有新用户可见英文字符串加入现有 i18n 资源，不在 JSX 中散落硬编码。
- label 与 input 通过 `htmlFor/id` 关联，不用 eslint disable 掩盖。
- decision controls 具有 radio group 语义、键盘操作和可见 focus。
- Dialog 具有标题、错误 announcement、focus trap 和关闭后 focus restore（优先复用现有 Dialog 能力）。
- 日期在 SSR 和首次 client render 之间不因 locale/timezone 产生 hydration mismatch。

阶段门禁：组件测试覆盖列表过滤/翻页、登录 gate、balance/max、三种 decision、非法输入、
已有 vote、remove、loading/error/success、points-only formatter、关闭状态禁用，并完成键盘基本检查。

## 9. 阶段 6：链模式回归与构建隔离

### 9.1 metadata

`page.tsx` 是 Next.js metadata 边界。将原链 metadata 逻辑保留在 route 导出中：

- 链列表：恢复 network-aware title/description/url/image alt。
- 链详情：恢复 index、内容摘要和 network URL。
- DemoOS 列表/详情：使用 points referendum 的 server data 生成不包含伪链信息的 metadata。
- 不指望动态导入的普通组件导出 `generateMetadata`。

### 9.2 provider 隔离

- server page 只在 `ENABLE_BLOCKCHAIN === 'true'` 分支动态导入 chain page body。
- DemoOS 组件树不得静态导入 `@polkadot/*`、wallet hooks/components、`polkadot_api_service`、
  indexer、conviction、delegation 或 lock 模块。
- API points route 不调用链 API；链模式不调用 points API。
- 无链运行时测试用 spy/mock 证明 wallet/RPC/indexer 初始化器未被调用，不只依赖构建成功。

### 9.3 链回归测试

`ENABLE_BLOCKCHAIN=true` 至少证明：

- 列表与详情选择原 API/provider。
- wallet/address picker、DOT formatter、conviction controls 仍在原流程。
- vote 提交仍调用 Polkadot transaction service。
- 不调用 `/api/v2/referenda/{index}/votes/me`。
- 原 metadata 关键字段保留。

`ENABLE_BLOCKCHAIN=false` 至少证明：

- 列表/详情不 redirect。
- 使用 points API/Firebase stats listener。
- wallet/DOT/conviction/delegation/chain analytics 不渲染不调用。

阶段门禁：两种 flag 的 provider/metadata/主投票路径回归测试通过，无链 no-keys build 通过。

## 10. 阶段 7：文档、格式与最终验收

### 10.1 文档必须更新

更新至少：

- `README.md`：不再把 points Referenda 称为 upcoming，添加功能与快速验证入口。
- `docs/ARCHITECTURE.md`：最终 domain/repository/service/provider 分层、Firestore paths、生命周期和信任边界。
- `docs/DEV_GUIDE.md`：emulator 命令、fixture/seed 方式和调试。
- `docs/DEV_NO_KEYS.md`：修正“upcoming”描述，说明无链 Referenda 可用能力和所需 Firebase 配置。
- API/schema 文档：路由、请求/响应、错误码、隐私裁剪、日期形式和 points 整数限制。

### 10.2 清理 diff

- 删除未使用的 `jasmine` 依赖，除非它已有实际测试用途。
- 恢复标准 dotenv 格式，但只在确认 `functions/.env.example` 异常改动属于本功能时修改。
- 仅对本次变更文件运行 formatter，不全仓库格式化。
- 检查 `git diff --check`、`git diff --stat` 和关键原页面 diff。
- 不要在未授权情况下恢复 208 个 SVG，但要在最终报告明确说明它们不应进入 Referenda PR。

## 11. 必须增加的测试矩阵

### 纯单元测试

- approval 低于/等于/高于 threshold，包括四舍五入反例。
- 零分母、仅 abstain、turnout 不足/刚好达标。
- points/balance/stats 负数、小数、NaN、Infinity、超 safe integer。
- delta create/同方向改 amount/改方向/remove/幂等 PUT/损坏 stats。
- 精确开始和精确结束时刻。
- Firestore -> domain -> HTTP DTO 日期和公开 vote 脱敏。
- capabilities 在两种 feature flag 下的值。

### Firestore emulator repository/service 测试

- 并发创建分配唯一 index，创建失败不单独消耗 counter。
- list status/origin 过滤、排序、分页、count 和 Timestamp 序列化。
- 新建 vote、改 amount、改 decision、remove、重复 remove、重复相同 PUT。
- 多用户同时投票，同用户并发改票，与 transaction retry。
- 每次最终 stats 等于从 votes 重算的结果。
- 缺失 referendum/user/stats，损坏 vote/stats 和余额下调后改票。
- 生命周期开启/结算/取消的幂等与竞态。

### API 集成测试

- 401/400/403/404/409 矩阵。
- uid/displayName/role/pointsBalance/author 伪造无效。
- own vote 固定 wrapper 响应。
- public history 不包含 uid/balance/email/role。
- create 返回 server author/index/最终初始 status。
- chain mode 不执行 points mutation。

### Rules 测试

使用第 4.3 节的完整 allow/deny matrix。

### 组件/页面测试

使用第 7、8、9 节的所有门禁，并额外验证不出现“undefined vote”、DOT 单位或 wallet controls。

## 12. 最终验证命令

先使用仓库实际 scripts；如在修复中新增了聚焦 script，同步更新文档。至少运行：

```bash
yarn test
yarn test:rules
yarn test:emulators
yarn tsc --noEmit
(cd functions && npm run lint && npm run build)
git diff --check
```

无链构建：

```bash
env \
  ENABLE_BLOCKCHAIN=false \
  ENABLE_INDEXERS=false \
  ENABLE_REDIS=false \
  ENABLE_ALGOLIA=false \
  ENABLE_AI=false \
  IS_CACHE_ENABLED=false \
  IS_AI_ENABLED=false \
  IS_NOTIFICATION_SERVICE_ENABLED=false \
  yarn build
```

链模式需运行聚焦回归测试。如链模式完整构建需要本地不存在的外部配置，不得伪造通过；
应报告精确 blocker，但仍要完成不需要密钥的 provider/component/service 回归测试。

如全仓库 lint/format 存在原有失败：

- 另行运行仅针对本次改动 TS/TSX/JSON/Markdown 的 lint/format check。
- 分别报告“本次引入”和“预先存在”的失败。
- 不使用 eslint disable 批量掩盖新问题。

## 13. 最终完成清单

Agent 只能在以下项目全部成立时宣布修复完成：

- [ ] P0-1 至 P0-4 有代码修复和回归测试。
- [ ] 所有 points API 使用稳定 DTO 和正确 HTTP 错误码。
- [ ] 事务内使用权威用户余额，投票与 stats 在并发下一致。
- [ ] 不安全/损坏聚合不被静默 clamp。
- [ ] index/referendum/stats 在一个事务中创建。
- [ ] 未来 Submitted 会准时开启，过期 Deciding 会幂等结算。
- [ ] 批准门槛判定不使用有偏四舍五入。
- [ ] own vote 请求正确携带 token，匿名/401 不会生成伪 vote。
- [ ] stats 使用 server initial data + 一个实时 listener，没有旧 HTTP 覆盖竞态。
- [ ] 投票 UI 包含 login、balance、max、三种 decision、编辑、撤销和完整错误/加载/成功态。
- [ ] 列表/详情实质复用原体验，且不显示伪链概念。
- [ ] Firestore rules 保护 referenda 且不为 posts/comments 引入越权。
- [ ] public vote history 不泄露 UID、balance 或私有 profile 字段。
- [ ] chain metadata 和原投票路径回归已修复/验证。
- [ ] `yarn test:emulators` 可重复运行，不依赖生产凭证。
- [ ] 单元、API、repository/service、并发、rules、组件、Functions build、typecheck 和 no-chain build 通过。
- [ ] README/架构/开发/no-keys/API 文档与实现一致。
- [ ] 最终 diff 没有新增无关资源、skill 或锁文件改动。

## 14. Agent 最终交付格式

最终回复必须包含：

1. 已修复的 P0/P1/P2 问题对照表。
2. 用户可见行为，分 DemoOS 和 chain 模式。
3. 数据模型、事务、生命周期和安全保证。
4. 复用的原组件与明确排除的链概念。
5. 实际执行的每个测试/构建命令和结果，不得只写“tests pass”。
6. 修改文件按 domain/backend/UI/security/tests/docs 分组。
7. 未执行验证、已知限制和真实 blocker。
8. 工作区中未触及但应从 Referenda PR 排除的无关已有改动。

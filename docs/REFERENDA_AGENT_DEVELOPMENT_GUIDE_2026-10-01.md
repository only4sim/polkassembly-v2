# Referenda 完整开发与验收指南

本文供 AI Agent 在 `polkassembly-v2` 仓库执行下一轮 Referenda 开发。目标是完成积分模式的正确性修复、实时交互、生命周期、富媒体、评论、社区体验、运营与发布检查，同时保留链模式。阅读本文不需要聊天上下文。

文档日期：2026-10-01。审计基线：`ec7d20d8`。本文是待执行指南，不表示开发已完成。所有新的验收项初始为未执行。

配套文件：[启动指令](./REFERENDA_AGENT_EXECUTION_PROMPT_2026-10-01.md)、[执行与验收记录](./REFERENDA_AGENT_EXECUTION_TRACKER_2026-10-01.md)。实施 Agent 应持续更新记录，不把工作仅留在聊天中。

## 1 任务边界与执行原则

交付完整可运行功能、测试、兼容方案、操作文档和验收证据。不能停在计划、空组件、模拟返回值或只通过编译的状态。允许按依赖顺序拆分多个 PR；没有真实阻塞时继续下一阶段。

实施前读取适用的 `AGENTS.md`、本指南、[API 合同](./REFERENDA_API_CONTRACT.md)、[既有产品指南](./REFERENDA_POINTS_DEVELOPMENT_GUIDE.md)、[架构](./ARCHITECTURE.md)、[开发说明](./DEV_GUIDE.md)、[无链运行说明](./DEV_NO_KEYS.md) 和 `README.md`。使用 Firestore、安全规则、Firebase 初始化或部署相关技能时，按当前环境提供的技能要求执行。

处理文档冲突的方法：

1. 用户最新明确指令优先；遵守适用的 Agent 指令和平台要求。
2. 本指南规定本轮范围和验收；旧审计、旧勾选状态只作为历史线索，不能证明当前代码正确。
3. 已冻结 API、积分和隐私规则继续有效。本文明确提出的扩展先记录兼容设计、更新合同和回归测试，再实现。不能借文档冲突随意改掉现有产品语义。
4. 本文标为“实施默认值”的内容是本轮建议，不是既有实现。没有更新的用户要求时可以据此推进；重大规则或外部付费服务的变化另行说明。

执行纪律：

- 开始先记录 `git status --short` 与当前 SHA，保护用户未提交修改。不要重置整个工作区或覆盖用户环境文件。
- 保留上游链代码。新增 DemoOS 文件、薄路由分支和可选能力；避免用积分实现替换链组件。
- 允许有依据地修复现有 DemoOS 文件，不应把“以新增为主”理解为禁止修 bug。
- 不新增链依赖；无链主流程不能初始化钱包、RPC、Polkadot、索引器或链分析服务。
- 不要求 Redis、Algolia、AI 或链密钥才能运行核心功能。复用现有 React Query、Firebase 和设计系统；不要建设第二套同类基础设施。
- 不削弱规则、DTO 校验或测试断言来获得绿色结果。不要硬编码成功状态或用 `window.location.reload()` 代替状态管理。
- 本地开发、模拟器、测试和文档属于实施范围。生产部署、生产数据迁移、付费资源创建单独记录环境与授权；已有明确授权时不重复询问。没有授权也要先完成本地可验证交付和可审阅的发布方案。
- 多 Agent 并行不是前提；如果当前环境明确允许，按文件划分责任，避免多人修改同一合同、规则或状态管理模块。

## 2 已有能力与审计证据

已有创建、投票、改票、撤票、管理员取消与手动结算、调度生命周期、评论发布删除、公开与本人投票 API、领域计算、安全规则及模拟器测试。保留正确实现，围绕真实缺陷补齐连接层。

2026-10-01 审计实际执行结果：

| 检查                         | 历史结果           | 证明边界                                                 |
| ---------------------------- | ------------------ | -------------------------------------------------------- |
| 单元及 API 合同测试          | 8 文件，114 项通过 | 不含真实浏览器流程                                       |
| Firestore rules              | 21 项通过          | 不证明 Admin SDK 路由鉴权正确                            |
| Firestore 服务与生命周期集成 | 34 项通过          | 不证明线上 Scheduler 已部署运行                          |
| TypeScript                   | 通过               | 不证明 UI 状态一致                                       |
| 前端 lint                    | 通过，有警告       | 不是无警告基线                                           |
| Functions build 与 lint      | 通过               | 不证明云端触发器或告警健康                               |
| 无链生产构建                 | 通过               | 使用本地环境并显式关闭可选集成；不是隔离环境的无密钥证明 |
| 链模式真实流程与线上配置     | 未执行             | 不能标为通过                                             |

历史测试数只是参照，实施后必须重新执行受影响检查。旧测试 fixture 曾包含数据库并不存储的派生字段，因此“已有测试通过”不能否定下面的问题。

| 编号 | 问题与证据入口                                                                                                      | 处理阶段 |
| ---- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| F01  | `statsDtoFromSnapshotData` 要求 `approvalBps/participatingPoints`，实际 stats 文档没有这两项，真实结构输入返回 null | P1       |
| F02  | 实时 stats 和 comments 使用初始 props 建立本地 state，后续服务端 props 不自动同步                                   | P2       |
| F03  | detail 与 capabilities 没有时间边界更新，投票 mutation 不更新公开历史与图表                                         | P2 P3    |
| F04  | 创建只 `router.refresh()`，不处理页码、筛选或导航；第一页无筛选仍需强刷的具体原因待浏览器复现                       | P2       |
| F05  | 详情弃权分母重复累加；列表参与积分排除弃权，只有弃权时可能显示无票                                                  | P1       |
| F06  | comments 和公开 votes 只取前 20 条，缺少 UI 分页；评论按最早排序，新评论重进页面可能不可见                          | P5       |
| F07  | 气泡图来自前 20 条，按阵营截断 10 条，但展开条件要求总数超过 30                                                     | P5       |
| F08  | `notFound()` 被 detail provider 的通用 catch 吞掉                                                                   | P1       |
| F09  | own vote 旧请求可回填；用户切换没有完整清理旧权限；admin 只跟踪 authReady                                           | P1 P2    |
| F10  | 本人历史 `collectionGroup('votes')` 的 count 混入 Discussion 投票；list 的 updatedAt 条件又与 count 不同            | P1       |
| F11  | 正文直接渲染字符串；comments 虽可渲染 Markdown，但编辑入口只是 textarea                                             | P4       |
| F12  | 共用 upload 路由未见鉴权、应用侧类型/大小/配额控制；视频渲染来源与生产 CSP 不匹配                                   | P4       |
| F13  | 全局 API 共享缓存策略覆盖用户相关路由，未显式区分 private；线上泄露未经验证                                         | P1 P8    |
| F14  | 成功摘要会被父组件立即卸载；附属查询失败拖垮全详情；部分权限错误静默隐藏                                            | P2 P6    |
| F15  | Cancelled 筛选缺失，origin 在导航中丢失，硬编码英文、表单反馈与可访问性不足                                         | P6       |
| F16  | 活动流从最近创建公投的当前状态拼出，不是真实事件；运营页主要是数量概览                                              | P7       |
| F17  | 5 分钟调度可能完全错过未来的短窗口；本地没有自动调度假设需要澄清                                                    | P3       |

F01 的最小回归输入必须来自生产 mapper/writer 的结构：`ayePoints=60, nayPoints=40, abstainPoints=10, ayeVoters=1, nayVoters=1, abstainVoters=1, totalVoters=3, updatedAt=Timestamp, schemaVersion=1`，不预填派生字段。期望 DTO 为 `approvalBps=6000, participatingPoints=110`，并实际更新组件。

## 3 代码入口

以下均相对仓库根目录。标注“新增”的文件在基线不存在，名称是建议，不应假装已有脚本或接口。

| 责任                 | 当前入口                                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 列表 provider 与 UI  | `src/app/(listing)/referenda/page.tsx`、`DemoReferendaPage.tsx`                                                |
| 详情 provider 与 UI  | `src/app/referenda/[index]/page.tsx`、`DemoReferendaDetail.tsx`                                                |
| 链模式保留实现       | 对应目录的 `ReferendaChainPage.tsx`、`ReferendaChainDetail.tsx`                                                |
| 积分组件             | `src/app/_shared-components/DemoReferenda/`                                                                    |
| 本人历史与管理面板   | `src/app/_shared-components/Profile/DemoProfile/DemoProfileActivity.tsx`、`src/app/referenda/admin/page.tsx`   |
| Client service       | `src/app/_client-services/points_referenda_client_service.ts`                                                  |
| API 与鉴权           | `src/app/api/v2/referenda/`、`src/app/api/_api-utils/referendaAuth.ts`、`referendaErrors.ts`                   |
| 可信读写服务         | `src/app/api/_api-services/referenda/referendumReadService.ts`、`referendumTrustedService.ts`                  |
| Domain 与 DTO        | `src/domain/entities/Referendum*.ts`、`src/domain/services/referendum*.ts`、`src/domain/dtos/ReferendaDtos.ts` |
| Repository 与 mapper | `src/adapters/firestore/FirestoreReferendumRepository.ts`、`referendaMappers.ts`                               |
| 生命周期             | `functions/src/lifecycle.ts`、`finalizeReferenda.ts`、`index.ts`                                               |
| 编辑器与上传参照     | `src/app/_shared-components/MarkdownEditor/`、`MarkdownViewer/`、`src/app/api/v2/upload/route.ts`              |
| 社区体验参照         | `src/app/_shared-components/PostComments/`、`PostDetails/`、`ListingComponent/`                                |
| 规则与运行           | `firestore.rules`、`firestore.indexes.json`、`firebase.json`、`next.config.mjs`                                |
| 测试                 | `src/**/__tests__/`、`tests/emulator/`、`tests/firestore/`、`vitest*.mts`                                      |
| 翻译与部署           | `src/intl/messages/`、`cloudbuild.yaml`、`Dockerfile`、`apphosting.yaml`                                       |

## 4 不可改变的产品规则

### 4.1 积分与结果

- 每个 Referendum 每个 Firebase UID 只有一张当前有效票。
- `pointsUsed` 为安全整数，范围 `1..当前权威 pointsBalance`。余额来自服务端用户文档。
- 投票不消耗或转移积分；记录当时的 `balanceAtVote`。余额变化不能静默重写旧票；改票重新验证。
- 支持 `aye/nay/abstain`。不引入 split、conviction、委托、钱包身份、锁仓、押金或链上执行。
- `turnout = ayePoints + nayPoints + abstainPoints`。
- `approval = ayePoints / (ayePoints + nayPoints)`；零分母显示 0。
- 最终结果使用 BigInt 交叉相乘和参与门槛，不能用四舍五入后的显示值判定。
- 零分母仅在 approval 门槛为 0 且 turnout 达标时通过；保持既有合同，不自行改为“零票永不通过”。
- 各投票占总参与积分比例使用同一 turnout 分母；若另画赞成/反对比例，显式标注它排除弃权。
- 当前票历史是有效票列表；改票覆盖当前票，撤票移除。不要把它称为不可变审计历史。若新增投票审计，只能私有保存，不能扩大公开投票身份范围。

### 4.2 时间与权限

- 时间窗口为 `startsAt <= serverNow < endsAt`，所有持久化日期由可信端生成或验证，HTTP 使用 ISO UTC。
- 客户端时钟只用于倒计时、立即禁用按钮及触发重验，不能写最终结果。
- `Submitted/Deciding/Confirmed/Rejected/Cancelled` 保持兼容。截止待结算是展示阶段，不冒充已结算结果。
- 管理员角色仍由可信 profile 决定。客户端隐藏按钮不是授权控制。
- 原有缺失票撤票幂等成功、创建已过期窗口返回 400 等合同继续有效。
- origin 在积分模式是分类标签，不代表链上权限或按分类自动获得管理员资格。

### 4.3 本轮实施默认值

以下选择用于消除不必要的产品等待，实施时写入决策记录；用户已有不同要求时以用户要求为准。

| 项目           | 默认方案                                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| 创建资格与门槛 | 保留当前认证用户可创建、合法门槛可设置；不新增积分消耗或强制管理员模板                                              |
| 投票配置编辑   | 创建后冻结 origin、投票窗口与结果门槛；改错通过取消后重建，不提供提前强制通过/拒绝                                  |
| 正文编辑       | 作者可修订标题/正文/标签，保留版本和修改时间；投票开始后显著显示修订提示；管理员不冒充作者修改观点                  |
| 草稿           | 按用户隔离的会话草稿与离开确认；退出清理，禁止在共享设备自动显示前一用户草稿                                        |
| 评论           | 一层回复；作者编辑、作者或管理员删除；已结束公投仍可讨论；独立的 discussionLocked 只限制评论写入                    |
| 删除与历史     | 有回复时保留删除占位；管理员移除内容后，原文不得从公开修订 API 再次读取                                             |
| 图片           | JPG、PNG、WebP、GIF，单文件不超过 5 MiB，单正文或评论最多 10 张；尺寸/解码资源设限；不允许 SVG/HTML 作为上传图片    |
| 视频与附件     | 本轮支持经白名单的 HTTPS 视频链接嵌入，首批 YouTube/Vimeo；不做视频文件托管、任意 iframe 或通用文件上传             |
| 媒体后端       | 优先 Firebase Storage，与现有 Firebase 配套并提供 Storage emulator；旧 imgbb 可保留链路径，不使其成为积分版必需服务 |
| 社区操作       | 正文与评论的赞成/反对互动、分享链接、管理员评论删除/讨论锁定纳入本轮；互动与治理投票完全分离                        |
| 订阅与通知     | 保留为后续里程碑；不纳入本轮完成分母，不渲染失效按钮                                                                |
| AI 与链分析    | 本轮不新增；关闭相关集成不影响主流程                                                                                |

正文修订不改变投票规则，但可能影响投票人的理解：显示“投票后正文已修改”提示，并允许在有效窗口内查看版本、改票/撤票。不能修改历史版本使其假装从未变化。

## 5 目标架构与兼容方式

### 5.1 状态只有一个可信更新入口

沿用 server provider 提供首屏 DTO，建立 Points 专用 React Query hooks。组件读取 query state；不要再同时维护 `initialProps`、本地列表、HTTP 结果和 snapshot 四份互相竞争的真相。

建议新增 `src/hooks/pointsReferenda/`，封装 detail、list、stats、capabilities、ownVote、comments、history、profile、events。既有 client service 保持 HTTP 和 DTO 边界；纯计算放在 domain。

Query key 至少区分资源、index、分页/筛选参数；私有资源另含 UID。capabilities、ownVote、myHistory、adminOverview 都要按身份隔离。匿名使用显式身份键；退出先取消请求、清除私有缓存、关闭投票弹窗，再展示新身份。

更新责任表：

| 资源                       | 主要更新源                                      | 降级与边界                                              |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------- |
| 详情公投                   | 一个公投 doc listener，经公共 DTO mapper 写缓存 | 断线保留最后值并标旧；重连或聚焦重验                    |
| 统计                       | 一个 stats doc listener，经纯 mapper 派生字段   | mutation 响应先更新；旧 snapshot 不覆盖较新 revision    |
| ownVote 与 capabilities    | 认证 API                                        | UID/index/status/revision/余额或时间边界变化后重验      |
| 列表与卡片统计             | 单个分页 API 批量读取                           | 可见页默认 15 秒重验，聚焦/重连重验；后台暂停轮询       |
| 公开投票、comments、events | 可信分页 API                                    | mutation 后失效；活跃页节流重验，避免每张票触发整页重读 |
| 本人历史与 admin           | 私有 API                                        | 登录变化清理；本地 mutation 后失效；显式重试            |

订阅公投文档前检查其中所有字段是否适合公开；私有审计字段放独立受保护文档，不能把私有信息添加到已有公开文档后再只依赖 HTTP DTO 隐藏。

为 snapshot 与 mutation/SSR 合并设计单调版本，例如事务更新 `revision`。旧文档缺失版本的兼容规则必须明确；不能用客户端 `Date.now()` 为缺失时间伪造新版本。错误消息和 stale 状态可恢复，卸载/index/UID 切换必须清理订阅与计时器。

### 5.2 数据与 API 扩展

保持现有路径、返回形状和错误体 `{ message }`。允许新增可选字段、端点和独立 DTO；不删除老字段或悄悄改变 `DELETE /referenda/{index}` 的取消语义。400/401/403/404/409/500 延续现有映射；限流新增 429 并记录 `Retry-After`。

拟新增能力与建议接口如下。具体命名可依据现有代码调整，但同一能力只能有一套可信业务实现。

| 能力           | 建议接口或数据                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------- |
| 正文修订       | `PATCH /api/v2/referenda/{index}`；版本读取 `/revisions`；写入要求 expectedRevision，冲突返回 409 |
| 评论编辑与回复 | 现有 POST 增可选 parentId；`PATCH .../comments/{commentId}`；分页支持独立根评论与回复             |
| 互动           | referendum/comment 下的独立 reactions API 与聚合；每 UID 最多一项，切换/取消为幂等操作            |
| 媒体           | Points 专属 media upload/resolve API、所有者/状态/大小/MIME/引用元数据；隔离于链上传接口          |
| 生命周期活动   | 公开 `referendaActivityEvents/{eventId}` 与分页 API，按实际事件时间排序                           |
| 私有审计       | 独立集合，只通过 admin API 读取；记录 actor、reason、前后版本、结算依据和关联请求                 |
| 讨论锁定       | admin moderation API，只改变讨论权限；记录原因和审计，不把锁讨论等同于取消投票                    |

分页先补完整 UI，再按性能需要增游标。保留 `page/limit/pageSize` 兼容；游标与 page 的优先级及非法组合写入合同。排序使用时间与 document ID 的稳定组合，不允许同时间项漏掉或重复。

本人投票历史必须限定 Referenda 类型。建议新增受控 discriminator 并使用对应 composite index，同时提供旧票兼容读取/回填；也可采用同事务维护的专用投影。不能只过滤查询后的当前页，因为 totalCount、分页和完整性仍会错。不能未经迁移就让旧票全部消失。

所有新增身份字段只来自认证与权威 profile。公开投票 DTO 仍只含现有批准字段，不公开 UID/余额；正文作者和评论作者现有公开 UID 合同与投票身份隐私是不同规则。

### 5.3 时间与生命周期

必须避免“公投窗口完全位于两次调度之间而无法投票”。默认实现以下组合，并在合同中明确这一扩展：

1. 对到期但仍 Submitted 的公投，服务端 capabilities 返回基于可信时间的可开票能力，不在 GET 中写数据。
2. 可信投票事务读取并确认到期后，原子完成合法 `Submitted -> Deciding` 激活与投票。先完成全部读取和输入校验；无效投票不产生半完成写入。客户端不能请求任意目标状态。
3. UI 在开始时重验，并允许进入有效窗口的投票流程，不再只检查陈旧的 `status === Deciding`。
4. Scheduler 负责无人访问时的转换与最终结算。默认把调度目标缩短至每分钟，记录成本；不把每分钟调度宣传为精确秒级结算保证。
5. 截止后立即停用投票，显示“投票结束，等待结算”；后台用同一精确算法产生终态，页面收到更新后展示最终结果。
6. 未开放且已过期的旧 Submitted 按兼容策略标 Rejected，并记录 `window_missed` 原因、显示“窗口错过”，不能伪称已经进行了正常投票。不得静默延长时间。

每次事务重试在可信端重验时间/状态，创建的初始状态也必须在创建事务尝试内决定。不要根据事务外提前计算的时间写入已过期状态。共享核心状态机或维护强制 conformance 测试，避免 Next 服务、manual finalize、Functions 分叉。

结算必须校验 stats 和门槛。损坏或丢失的必要统计不能静默归零并写终态；记录失败并保留可修复状态。零票的新公投应有合法的空 stats 文档。

调度采用稳定遍历/游标与有界批次，失败项不能反复占据第一批导致后续公投饥饿；记录 backlog、scanned、opened、finalized、failed 和 oldest overdue。顶层失败触发重试，文档级失败进入可观察的重试流程。并发、重跑不能产生重复终态或重复活动事件。

### 5.4 媒体与内容安全

复用编辑器的中性能力，审计其 `useUser`、地址、链上下文依赖；需要时新增 Points adapter，不把整套链身份树引入无链编辑器。

统一安全 Markdown renderer。默认拒绝原始任意 HTML，或采用明确 sanitizer allowlist；仅凭 React 转义不能证明 `rehypeRaw` 路径安全。验证链接协议、host、iframe 来源，不用 substring 判断视频网站域名。不允许任意 srcdoc、script、事件属性、危险 URL 和服务端任意 URL 抓取。

上传处理必须验证 Firebase 身份、文件真实签名、字节数、像素/解码资源、允许类型和用户配额。不能只信 filename/MIME/Content-Length，也不能让流式输入无限进入内存。服务端分配不可预测对象名；不能接受客户端给出的 Storage 路径或删除任意对象。

媒体生命周期为 staged、published、删除/回收状态：

- staged 文件只供所有者预览；不可通过永不过期的公开下载 token 泄露草稿。开发预览可用本地 blob 或受鉴权预览路由。
- 保存正文/评论时，可信端验证媒体所有者、状态与上下文，并绑定引用；不能引用其他用户的未发布文件。
- 内容中推荐持久化稳定 mediaId/内部 URL，避免临时上传 URL 过期或把凭证写入 Markdown。
- published 媒体按所属公开内容权限提供读取。管理员移除内容后，公开修订和媒体解析不能绕过移除策略；已被外部缓存或保存的内容不承诺可撤回。
- 孤立 staged 对象默认 24 小时清理。已被正文、评论或合法修订引用的对象不被误删；并发发布与清理有状态检查。
- Firestore 和 Storage 无跨服务原子事务：使用可重试状态机、幂等 finalize 与补偿清理，不声称一次事务覆盖两者。

Storage 未配置时提供明确可恢复错误和保留草稿，不影响纯文本；要标记“富媒体完成”，仍必须有本地 Storage emulator 的完整上传到展示测试。生产 bucket 未配置单独记为发布条件。

为图片、YouTube/Vimeo 白名单配置最小 CSP。维持其他安全头，不使用全局 `*` 或关闭 CSP 解决嵌入问题。生产构建运行下测试图片和视频，不只测开发服务器。

### 5.5 鉴权与缓存

私有 GET（own vote、本人历史、capabilities、admin、草稿/未发布媒体）显式 `Cache-Control: private, no-store`；写入与鉴权错误也不共享缓存。公共端点按资源设计短缓存/重验，不能延用全局 API 共享缓存默认值。

保留链模式原行为或做经过双模式验证的最小安全修复；避免扩大跨域权限。客户端可对私有请求使用 no-store，但这不能替代服务端响应头。验证源站与测试环境 CDN/代理的实际响应，不只检查源码。

认证服务不得在可公开访问环境依靠未校验签名的 JWT 解码兜底。发现现有 development fallback 时，把模拟器使用变成显式且受环境约束的配置，测试生产始终 fail closed。身份变化时 old response 必须丢弃，token 刷新最多一次受控重试；非幂等创建重试需要 idempotency key。

上传、创建、评论和 reactions 配置可调的服务端限流/配额。无 Redis 是硬约束，不能只用单进程内存冒充多实例限流。超限给出 429，不暴露 token 或私有 profile。

## 6 分阶段实施任务

顺序为 P0 → P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8。每阶段可以进一步拆 PR；后续验收依赖前一阶段的数据契约。不要重复重写已通过验证的后端。

### P0 基线与可重复复现

- 记录代码版本、工作区、工具版本、package manager、锁文件、feature flags 和模拟器端口；只记录变量名与必要布尔值，不复制密钥。
- 重新核实 F01 至 F17；每项标“已复现”“代码确认”“环境待核实”“已在新版本修复”，附证据。
- 建立真实 writer → document → client mapper → UI 的回归测试，先捕获 F01，不复制错误 DTO fixture。
- 新增 React 组件测试设施与 Playwright 浏览器测试设施（如已有则复用），写入 scripts 和独立配置；不把缺少脚本算通过。
- 建立隔离种子：普通用户 A/B、管理员、无余额用户，Submitted/Deciding/三种终态、短窗口、全弃权、超过一页的评论与投票、旧 schema 数据。
- 测试 runner 只清理专用 emulator 测试 project。当前 rules 测试有固定 project、各测试配置有固定端口；先参数化/隔离，不能清掉开发者的现存模拟器数据。

门禁：基线与已知失败可重现，测试环境不使用生产凭证，记录中有下一项可执行任务。

### P1 正确性与私有数据边界

- 修复 F01/F05/F08/F10；派生统计集中在纯函数，覆盖空 stats、真实 Timestamp、缺字段、损坏值、整数溢出。
- 修复 notFound 控制流；严格验证 index 和 query 的 safe integer、allowlist、范围，URL provider 和 HTTP API 使用同一解析规则。
- 统一参与积分/赞成率/占比；只有弃权时显示真实参与，而不是无票。
- 为本人历史建立范围正确且兼容旧票的查询/投影；加入同 UID 同时参与 Discussion 和 Referenda 的测试。
- 私有接口缓存、身份切换、请求过期保护与安全认证兜底按第 5 节处理；管理员页面退出立即清理。
- 缺失头像/显示名使用确定的公开 fallback，不能因 DTO 要求非空而在写成功后让客户端误报失败；禁止回退到 email 公开显示。

门禁：旧失败测试通过；权限/隐私回归通过；私有缓存响应测试、A/B 切换和 API 非法参数检查通过。

### P2 查询层与实时体验

- 实现第 5.1 节的 query hooks 与更新责任；使用现有 QueryClient，不新增平行 provider。
- 创建成功用响应中的 index 导航到详情，同时失效各列表；保留失败输入、防重复创建、网络不确定结果使用幂等重试。
- 投票响应立即更新 own vote/stats，失效公开历史/图表/本人历史/列表；另一个窗口通过订阅或有界重验同步。
- 取消/结算更新 detail、capabilities、list、events；投票成功摘要应可见并由用户关闭或按明确交互导航。
- 处理 SSR 后 props、snapshot、mutation 响应顺序；晚到的初值和旧请求不能覆盖新数据。
- 区分首屏加载失败、空列表、实时断线、匿名、权限加载、余额不可用和会话失效。附属 comments/history 失败不能阻止已有详情和合法投票。
- 注销/切换账户时清理旧弹窗、草稿、私有 cache；同页切换 index 不展示上一个公投的统计。

门禁：双窗口测试无需完整刷新；创建在第一页/第二页/筛选页均进入正确详情；断线恢复和卸载不产生重复 listener。

### P3 生命周期与后台可靠性

- 实现第 5.3 节；补 exact start、exact end、短窗口、长时间无人访问、调度漏跑和管理员同时取消。
- 创建时间与初始状态计算移入事务尝试；检查 counter 加一后的溢出，不只检查旧 counter。
- 前端返回 serverNow/时间基准并在后台恢复时重验，客户端时钟偏差不改变最终有效性。
- 提供只面向 emulator 的一次执行/循环执行 runner，支持可注入时钟与明确停止，不默认连接生产。
- 记录 pending finalization 与 missed window 原因；管理员只能触发规则允许的结算/取消，不能任意指定结果。
- 调度、lazy activation、管理员操作共享幂等状态机；修复失败项饥饿，输出机器可读 run summary。

门禁：短窗口内用户能合法投票；截止后的 server 请求必拒绝；重复结算、并发取消/投票不会破坏统计；失败项不阻塞后续批次。

### P4 正文编辑与富媒体

- 创建正文、正文修订、评论输入共用 Points 编辑能力：Markdown、图片、链接、列表、引用、代码和表格、预览。
- 实现第 5.4 节的 Storage adapter、媒体 API/元数据、规则、上传进度、重试、配额和清理。
- 正文采用统一安全 renderer；兼容既有纯文本/Markdown，不执行旧文本中的危险 HTML。
- 编辑使用 expectedRevision；历史写入与正文更新原子完成；显示修订和投票后内容变化提示。
- 加入拖拽/粘贴文件、图片 alt、移动端布局、上传失败保留输入与导航确认。
- 视频仅走固定 host 与 ID 解析，不做任意远程下载；生产 CSP 与组件支持范围一致。

门禁：正文/评论从上传、保存、重新打开到生产模式展示都成功；越权媒体引用和危险内容测试通过；链编辑器回归不受影响。

### P5 评论与历史完整性

- 实现根评论分页、单层回复、编辑、版本、删除占位；作者和管理员权限分别在 API 和 UI 验证。
- replies 的 parent 必须存在且属于同一公投；拒绝循环/跨公投引用/超深回复；计数与写入保持一致。
- 区分根评论、回复和可见总数的定义；分页排序稳定，发布后定位新增项，筛选切换去重且不遗留旧页。
- 增加公开投票 decision filter、分页与总数；本人历史补分页和缺失公投的合理占位。
- 气泡图明确标“当前页”或“采样”；总量使用 stats，不把样本相加称为全部。默认每页所有气泡可访问，展开条件按实际隐藏数量计算。
- 面积映射要与文案一致；若设置最小气泡尺寸，不能声称全区间严格面积正比。提供可键盘访问的数值表，不能只靠 hover。

门禁：至少 50 条评论、100 张票、一组同时间记录和多页回复可完整访问；新评论刷新后仍可找到；删除/改票后总数正确。

### P6 产品体验与社区操作

- 列表支持全部合法状态（含 Cancelled）、origin、稳定分页；链接保留其他筛选；查询无效有明确错误。
- 搜索本轮至少支持精确编号定位与 URL 分享；全文搜索只在已有可用 provider 下扩展，不引入 Algolia 必需依赖。
- 所有创建限制在 UI 与服务端一致；显示本地时区和 UTC 存储含义；门槛单位用百分比辅助输入，校验基础点转换。
- 完成登录引导、pointsBalance/max、成功摘要、失败重试、草稿与离开确认。
- Referendum/comment 点赞与反对是独立 reactions，不改变 points、治理票或 stats；每用户一项，可取消/切换，可信事务聚合并限流。
- 分享按钮复制规范 URL，comments 有可定位 anchor；元数据包含公投编号/标题/安全摘要，不能含私有投票数据。
- 完整迁移新增字符串到 en/zh/de/es/ja；日期用一致 locale/timezone 策略，避免 SSR hydration mismatch。
- Dialog 描述/焦点/关闭、表单错误关联、键盘操作、屏幕阅读器状态、非颜色提示、移动端溢出都需要实测。

门禁：主要流程能用键盘完成；小屏和桌面可用；英文/中文无遗漏关键文本，其余 locale 有完整键和可解释 fallback；reactions 不影响投票结果。

### P7 活动流与运营

- 创建、实际开票、修订、取消、结算写真实事件；使用稳定幂等 ID，与业务状态同事务写入或有可靠 outbox。
- 事件记录实际 occurredAt，计划开始/结束时间另存；不能把预定时间伪装成真实调度执行时间。
- 按事件发生时间展示活动，旧公投的新结算也能出现在最新动态。公开事件不包含逐票身份/余额/管理员私有资料。
- admin 提供待开票、截止未结算、失败原因、最近处理时间、重试和取消原因；操作记录 actor 与结果。
- 实现独立讨论锁定和管理员删除评论；锁定不修改投票门槛/状态，解锁恢复讨论。
- 提供结构化日志、错误率/延迟/积压指标与告警配置或可部署定义。只有数量卡片不能称为完成 observability。
- 对 stats 热点、分页 offset、聚合 count、监听器数和查询次数做压力/读成本记录；没有测量证据不先引入复杂分片。

门禁：晚发生事件可见；重试没有重复事件；管理员能定位并处理待结算原因；公开 API/Firestore 规则无法读取私有审计。

### P8 双模式与发布验收

- 执行第 7 至 9 节全部门禁，修复失败；记录真实外部条件阻塞，不把 skipped 标为 passed。
- 更新 API/数据/索引/媒体/本地运行说明、README 与旧进度文档；移除本轮范围内错误的“全部完成”勾选。
- 审查 .env.example、Docker、App Hosting、Cloud Build 的 build-time/runtime flags，防止 server/client 选中不同模式。构建不得打包私钥到客户端。
- 在仓库实际使用的 CI 中接入 unit/type/lint、Functions、rules/integration/media、组件与浏览器测试、双模式构建；使用隔离模拟器和测试配置。按成本拆 job，但关键失败必须阻止合并或发布。保存失败 trace、截图和脱敏日志，不能只新增一份无人执行的 workflow。
- 提供发布/迁移/回滚步骤和兼容窗口。先完成本地证据，再进行已获授权的测试环境/生产动作。

门禁：功能、自动化检查、运行环境证据分别明确；达到最终完成定义后才能宣称整个任务完成。

## 7 必须实现的验证矩阵

每行至少对应一个可重复测试或明确的运行验收记录。UI 正确性必须直接测试组件/浏览器，不能仅测重写后的 helper。模拟服务测试与真实模拟器测试应分开标注。

| ID  | 场景                 | 必须断言                                                                                                     |
| --- | -------------------- | ------------------------------------------------------------------------------------------------------------ |
| T01 | 真实 stats 文档到 UI | 缺派生字段仍正确更新；60/40/10 得 approval 6000、turnout 110；无假 Timestamp                                 |
| T02 | 统计/数值边界        | 全弃权、零票、阈值下/等/上、半基础点反例、安全整数及总和溢出、损坏 stats                                     |
| T03 | 投票事务             | 创建/改票/撤票、相同 PUT、无票 DELETE、多用户与同用户竞争，stats 等于有效票重算                              |
| T04 | 权威身份与余额       | body 伪造身份/角色/余额无效，余额变化重新校验，未登录/过期 Token/缺 profile 正确报错                         |
| T05 | 生命周期             | startsAt 前/等/后、endsAt 前/等/后、短窗口、漏跑、重复调度、并发 vote/cancel/finalize                        |
| T06 | 调度异常             | 损坏第一批不饿死后续；有界处理；顶层错误重试；文档失败可定位；事件幂等                                       |
| T07 | 创建                 | 第一页/第二页/过滤页，新公投跳转正确；失败保留输入；双击/网络重试不重复创建                                  |
| T08 | 双浏览器更新         | A 投票 B 看到 stats；双方看到历史/状态；改票/撤票/取消同理，不强刷                                           |
| T09 | 身份和异步竞态       | A 慢响应晚于 B 登录仍被丢弃；退出清私有 state；admin 退出清 overview；切 index 不串数据                      |
| T10 | 请求/订阅顺序        | SSR、mutation、旧 snapshot 乱序不回退；卸载无泄漏；同屏相同资源不重复订阅                                    |
| T11 | 截止和恢复           | 弹窗打开期间截止立即禁用；后台恢复/时钟偏差重验；断网保留旧值并标注，重连恢复                                |
| T12 | HTTP 与路由          | 404 与 500 分离；非法 page/status/origin/index 为明确 4xx；附属区错误不拖垮详情                              |
| T13 | 隐私缓存             | 两个身份与匿名访问同 URL，源站及可用代理无串数据；私有响应/错误不共享缓存                                    |
| T14 | 混合业务历史         | 同 UID 有 Discussion 与 Referenda 票，count/list 都只返回 Referenda；旧票仍可见                              |
| T15 | 评论与公开历史       | 50+ comments/100+ votes、同时间 tie、分页/filter、回复、编辑冲突、删除占位与计数                             |
| T16 | 媒体成功流程         | 选择/拖拽/粘贴、上传、预览、保存、重新打开、进度/重试、生产 CSP                                              |
| T17 | 媒体安全与清理       | 无登录、伪 MIME、超限/超像素、SVG、路径伪造、越权 staged 引用、清理与发布竞争                                |
| T18 | 内容渲染             | Markdown 正文/评论/修订一致；script、事件属性、javascript URL、iframe/srcdoc、伪视频 host 拒绝               |
| T19 | 正文修订             | 作者授权、非作者拒绝、expectedRevision 冲突、投票后提示、配置不可修改                                        |
| T20 | 互动和讨论权限       | 点赞切换/撤销幂等、不影响治理；admin 锁定/删除，普通用户不能越权，旧回复不泄露移除原文                       |
| T21 | Rules                | 匿名/本人/他人/admin 的 get/list/write 矩阵；votes/stats/role/points 直写拒绝；Storage staged/published 权限 |
| T22 | 活动与运营           | 旧公投的新事件出现、事件去重、后台错误指标、私有审计不能公开读取                                             |
| T23 | 国际化与可访问性     | locale 文案、时区一致、键盘/焦点/读屏、图表替代表、移动布局                                                  |
| T24 | 无链隔离             | 无链密钥、无 Redis/Algolia/AI；浏览器无钱包/RPC/indexer 请求；原生 E2E 登录与投票成功                        |
| T25 | 链模式隔离           | 原 provider/API、钱包/DOT/conviction、交易服务调用和 metadata 保留；不请求 Points API                        |
| T26 | 性能与可观察性       | 每页查询/监听器预算，20 个并发写入的正确性与延迟记录，分页可重复，调度 backlog 可见                          |
| T27 | 迁移与兼容           | 旧文档、双版本 app/functions、discriminator/revision 默认、迁移中断续跑与回滚                                |

实施目标：正常测试环境下 stats mutation 本地确认后立即反映，另一窗口 stats/状态在 5 秒内可见；历史/列表重验在 15 秒周期加请求耗时内；前台截止按钮在 1 秒量级刷新。把这些作为可测目标，记录基础设施条件，不把网络或后台标签页计时器节流包装成硬 SLA。端到端测试采用条件等待与受控时钟，不堆固定长 sleep。

## 8 命令与环境

### 8.1 已存在的命令

从仓库根目录执行，使用既有锁文件对应包管理器。以下 npm 形式便于复现，不要求更换锁文件：

```bash
git status --short
git rev-parse --short HEAD
npm test
npx tsc --noEmit --incremental false
npm run lint
npm --prefix functions run build
npm --prefix functions run lint
```

现有 `test:emulators` 只启动 Firestore 并运行 rules 和服务/lifecycle 测试，不是 Auth/Functions/浏览器全流程。端口 8080 等必须空闲，或者先统一调整测试配置；不要停止不属于自己的开发进程。

```bash
firebase emulators:exec --only firestore --project demo-referenda-agent 'npm --prefix functions run build && npx vitest run --config vitest.rules.config.mts && npx vitest run --config vitest.integration.config.mts'
```

上述命令需要先完成 P0 的项目/端口隔离。`--project` 本身不会改掉测试文件内部硬编码的 projectId。规则测试读取当前规则文件，不对线上部署。

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
npm run build
```

此命令仍可能加载本地 `.env*`。无密钥验收必须另外在干净工作副本/CI 容器中用专用 demo 环境执行，不能靠给现有命令加 `env -u` 就声称 Next 不会读回环境文件，也不能删除用户现有 `.env.local`。

### 8.2 本轮必须新增的测试命令

新增并在 package.json 验证以下能力，名称可调整但须更新本文和 tracker：

- `test:components`：有 DOM 环境的 React 交互测试。
- `test:e2e:points`：Auth/Firestore/Functions/Storage emulator、隔离种子、Next server、浏览器与清理的完整 runner。
- `test:e2e:points:production`：生产构建运行，验证 SSR、HTTP 缓存和 CSP。
- `test:e2e:chain`：链 provider 的 mock/测试环境回归；禁止自动提交真实链交易。
- `test:media`：Storage 规则与上传生命周期测试。
- `referenda:lifecycle:emulator`：本地可信生命周期执行。

基线的 `firebaseClientApp.ts` 只在 development 自动连接 emulator。要让生产构建 E2E 安全运行，新增显式的测试 emulator 配置并限制目标为测试 project；服务端和客户端都必须指向模拟器。不能让 `next start` 搭配 demo 种子时意外访问线上 Firebase。

runner 必须传播子命令失败退出码、等待健康检查、设置超时、清理自己启动的进程，并在日志中脱敏。模拟器不会自动证明 Cloud Scheduler 行为，需要显式调用 handler 的测试和已授权测试环境调度验收。

### 8.3 链模式检查分层

1. 静态检查：保留原链文件和接口、feature flag 的入口一致。
2. 构建：服务端与 `NEXT_PUBLIC_ENABLE_BLOCKCHAIN` 均为 true 的独立构建。
3. 浏览器 mock 回归：原 API、钱包/DOT/conviction 界面和交易 service 调用；断言没有 Points API 请求。
4. 已授权测试环境 smoke：真实连接/数据获取与可审阅的测试交易流程。没有钱包、端点或授权时标外部待验，不能伪造成功，也不能擅自花费资产。

构建和开发服务器不要并发写同一个 `.next`；两种模式使用隔离输出或顺序构建。记录每种模式的 flags、构建和运行日志。

## 9 数据迁移与发布

本地 emulator 已验证的是 Standard edition，不代表生产数据库 edition。涉及实际数据库/Storage 配置前，用当前 Firebase 工具确认目标 project、database ID、edition、region、bucket 和相关权限，按适用技能执行；不要从项目名猜目标。

所有 schema 扩展必须提供兼容矩阵：老文档被新代码读取、新字段被旧代码忽略、迁移前后 rules、旧/新 Functions 同时运行的行为。迁移脚本默认 dry-run，要求显式 project/database 和 emulator/生产标记，有 checkpoints、幂等、批次上限、备份与摘要，不能删除旧票重建。

建议发布顺序：

1. 完成测试证据与目标环境核实，记录现有 app/functions/rules/indexes 版本及数据备份。
2. 部署向后兼容的 indexes，等待 ready；新查询与 index 一一对应。模拟器测试不能代替生产 composite index 就绪检查。
3. 按兼容矩阵部署 rules/Storage rules 与兼容服务，不能在新版客户端上线前破坏老读取。
4. 在明确授权后执行必要回填并核对 counts/样本；旧票尚未回填时保留安全兼容路径。
5. 部署 Functions 与 Scheduler，检查触发器、时区、重试、IAM、日志与积压。
6. 部署 Next app，核实 build/runtime flags、媒体配置、私有 Cache-Control 与生产 CSP。
7. smoke 验证创建、双窗口投票、媒体、评论、取消与自动结算；观察错误率/延迟/积分统计不变量。

回滚必须指定 app/functions artifact、是否关闭新增写入、旧代码读取新文档的行为和 rules 的兼容版本。停止有问题的调度写入可以是应急措施，但不能回滚已确认结果或删除数据掩盖错误。已发布内容/媒体的删除遵守产品保留策略，不能由回滚脚本任意清空。

## 10 最终交付与完成定义

每阶段在 [tracker](./REFERENDA_AGENT_EXECUTION_TRACKER_2026-10-01.md) 留下代码路径、命令、退出码、测试数量/场景、环境与限制。测试日志过大时保存脱敏文件/CI artifact；截图辅助视觉验收，不能代替交互测试。

完成状态必须同时包含：

- P0 至 P8 所有必需实现完成；F01 至 F17 每项有关闭证据或经用户接受的范围决定。
- T01 至 T27 均有实际结果；失败必须修复，真实外部依赖阻塞明确列出。
- 核心领域规则、现有 API 与公开投票隐私保持正确，新增合同/迁移有对应测试。
- 创建、投票、改票、撤票、开始、截止和终态更新无需强刷。
- 正文和评论图片可编辑、上传、保存与展示；评论、历史分页和权限真实可用。
- 双模式构建与运行回归分开列证据；无链本地运行不依赖链/Redis/Algolia/AI 密钥。
- 文档与代码一致，旧“已完成”表不再夸大实时、分页、运营或浏览器验证状态。
- 变更后运行适当 tests/type/lint/build/格式与 `git diff --check`，保护无关用户修改。
- 发布准备与实际发布分别报告。没有部署授权可以交付完整代码与本地验收，但线上发布状态必须写“未部署/待验”，不能宣称全部环境已经验收。

最终回复应简洁列出已完成范围、关键文件、测试结果、仍未执行的外部检查与准确原因。上下文即将耗尽时先更新 tracker 的恢复信息，后续 Agent 从下一未完成任务接续，不从旧计划的第一阶段重做。

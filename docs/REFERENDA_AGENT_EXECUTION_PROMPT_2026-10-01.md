# Referenda 开发 Agent 启动指令

将下面指令交给位于本仓库的 AI Agent。它要求实际实现和验收；本文件自身不表示这些工作已经完成。

```text
你负责完成 polkassembly-v2 的下一轮 Referenda 开发与验收。

仓库默认路径：/workspaces/polkassembly-v2；若实际路径不同，以当前 git 根目录为准。

先检查工作区与适用的 AGENTS.md，保护用户未提交修改。完整阅读：
1. docs/REFERENDA_AGENT_DEVELOPMENT_GUIDE_2026-10-01.md
2. docs/REFERENDA_AGENT_EXECUTION_TRACKER_2026-10-01.md
3. docs/AGENTS.md
4. docs/REFERENDA_API_CONTRACT.md
5. docs/REFERENDA_POINTS_DEVELOPMENT_GUIDE.md
6. docs/ARCHITECTURE.md、docs/DEV_GUIDE.md、docs/DEV_NO_KEYS.md、README.md

主指南是本轮执行范围，API/积分/隐私合同继续有效。历史计划的勾选不能证明功能已经完成。
不依赖之前的聊天；不要重复重建已经正确的后端。先复核当前代码与主指南 F01 至 F17 的差异。

任务是实际开发，而不是再给一份计划：按 P0 到 P8 连续执行，补代码、测试、迁移兼容、
运行工具和文档，直至完成定义满足或遇到真实外部阻塞。每阶段有证据再更新状态。
不要在实现一个模块或测试变绿后提前结束，不要把未执行的浏览器/链模式/线上检查标通过。

必须交付：
- 真实 Firestore stats 文档到实时 UI 的正确转换、统一统计口径。
- SSR、Query、snapshot、mutation 的统一状态管理，创建后正确导航。
- 身份隔离、旧请求丢弃、私有缓存保护、404 与错误隔离。
- 精确时间边界、短窗口可投票、截止停投与待结算展示、可靠后台生命周期。
- 正文/评论共用安全 Markdown 编辑渲染，图片上传、预览、重试、生命周期与生产 CSP。
- 正文修订、评论回复/编辑/删除/分页、公开与本人投票完整分页、准确的图表说明。
- 筛选、互动、分享、国际化、移动端与键盘可访问性。
- 真实活动事件、管理员讨论操作、审计、调度积压与故障可观察性。
- T01 至 T27 的可重复验证、双模式回归、兼容迁移和发布/回滚说明。

约束：
- 保留上游链模式；ENABLE_BLOCKCHAIN=true 仍使用原钱包/DOT/conviction/交易路径。
- 积分模式不初始化链服务，不要求 Redis/Algolia/AI，不改变不扣分和余额快照规则。
- 时间/身份/权限/积分/最终结果由可信端决定，不允许浏览器直接写 votes/stats/role/points。
- 公共投票 DTO 不泄露 UID、余额或私有 profile；正文/评论作者合同单独处理。
- 不用强制刷新、关闭校验、放宽 rules、跳过失败测试或虚假 fixture 掩盖问题。
- 保留旧 API 和旧数据。新增 schema/query 必须有兼容读取、索引和可审阅迁移。
- 使用主指南的实施默认值推进，记录决定；不自行加入链机制、视频托管或完整通知系统。
- 使用当前可用且适用的技能；遵守当前环境关于工具和多 Agent 的要求。
- 不泄露密钥，不覆盖用户 .env，不连接生产数据做测试，不提交真实链交易。
- 本地工作与可审阅交付持续推进；外部部署/迁移按已有授权执行，缺授权只阻止相应外部动作。

开始时复核 package scripts/锁文件/模拟器端口和测试 project。新增缺失的组件、浏览器、
媒体和生产模式 E2E runner；单靠现有 test:emulators 不算完成 Auth/Storage/UI 验收。
基线生产 E2E 需要显式 emulator routing，不能让 next start 意外连接线上 Firebase。

维护 docs/REFERENDA_AGENT_EXECUTION_TRACKER_2026-10-01.md：
- 每个 F/T/P 的状态与证据；决策、schema/API 变化、命令退出码和测试环境。
- 真正的 blocker、可继续的独立工作、恢复所需条件。
- 当前文件、进程/端口、最后验证版本和下一项可直接执行的任务。

完成前重新运行受影响测试、typecheck、lint、Functions build、两种模式构建与回归、
目标文档格式检查和 git diff --check。按主指南分清本地完成、测试环境验证、线上发布。
最终回复提供关键交付和验证结果；外部检查没跑就明确写未执行，不能声称全部完成。
```

中断后继续时可使用：

```text
继续 Referenda 开发。先读取主指南和 execution tracker，检查 git status 与当前代码，
复核上一轮最后变更之后的证据。保留已有正确实现与用户修改，从下一未完成任务继续，
不要把历史基线测试当作当前通过结果。持续执行到完成定义满足或真实阻塞。
```

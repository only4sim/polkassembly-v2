# Points Referenda API Contract

> 冻结日期：2026-09-07（PR-1，依据 `REFERENDA_REPAIR_AND_DEVELOPMENT_PLAN_2026-09-07.md` 阶段 0）  
> 适用范围：`ENABLE_BLOCKCHAIN=false` 下的 `/api/v2/referenda` API 族  
> 权威来源：本文档 + `src/app/api/v2/referenda/__tests__/apiContract.test.ts` + `tests/emulator/referendaService.test.ts`  
> 修改规则：任何 contract 变更必须先更新本文档与上述测试，再改实现。

## 1. HTTP 端点与响应形状

所有日期均为 ISO-8601 UTC 字符串。所有响应体顶层键固定如下。

### GET `/api/v2/referenda`

查询参数（PR-1 冻结）：

| 参数       | 规则                                                       |
| ---------- | ---------------------------------------------------------- |
| `page`     | 正整数，默认 `1`                                           |
| `pageSize` | 整数 1..50，默认 `10`                                      |
| `status`   | 可重复和/或逗号分隔；每个值必须是合法 `ReferendumStatus`   |
| `origin`   | 单值，必须属于领域 origin allowlist（`REFERENDA_ORIGINS`） |

非法取值一律返回 `400`，不静默丢弃。

```json
{
	"items": [ReferendumSummaryDto],
	"totalCount": 123,
	"page": 1,
	"pageSize": 10
}
```

`totalCount` 为过滤后的真实总数（count aggregation），不是本页条数。

### POST `/api/v2/referenda`

请求体：`title, content, origin, tags?, votingStartsAt, votingEndsAt, approvalThresholdBps, minimumTurnoutPoints`。UID/角色/余额一律取自服务端，请求体中的身份字段被忽略。返回 `201`：

```json
{ "referendum": ReferendumDetailDto }
```

`referendum.status` 为响应时的持久化状态（已开始的创建会返回 `Deciding`）。

> 初始 `Submitted`/`Deciding` 状态在创建事务内用一次捕获的 server `now` 决定（PR-4 已实现）：
> `now < startsAt` → `Submitted`；`startsAt <= now < endsAt` → `Deciding`；`now >= endsAt` → 拒绝创建（400 invalid-dates）。

### GET `/api/v2/referenda/{index}`

```json
ReferendumDetailDto
```

不存在返回 `404`。

### DELETE `/api/v2/referenda/{index}`

管理员取消（`users/{uid}.role == 'admin'`，服务端读取）。返回 `200`：

```json
{ "message": "Referendum cancelled." }
```

### GET `/api/v2/referenda/{index}/stats`

```json
ReferendumStatsDto
```

### GET `/api/v2/referenda/{index}/votes`

公开投票历史。`limit` 1..50（默认 20）。

```json
{
	"items": [PublicReferendumVoteDto],
	"totalCount": 7
}
```

`totalCount` 为真实总票数。

**隐私合同（audit REF-SEC-01）**：`PublicReferendumVoteDto` 只允许
`voterDisplayName, decision, pointsUsed, createdAt, updatedAt`；
禁止 `uid`、`balanceAtVote`、email、role、`pointsBalance` 及其他私有 profile 字段。

### GET `/api/v2/referenda/{index}/votes/me`

需要有效 Firebase ID Token（`Authorization: Bearer <token>`）。

```json
{ "vote": ReferendumVoteDto | null }
```

`ReferendumVoteDto` 含审计字段 `uid` 和 `balanceAtVote`，仅返回给投票者本人。

### PUT `/api/v2/referenda/{index}/votes/me`

请求体：`{ decision: 'aye'|'nay'|'abstain', pointsUsed: 正整数 }`。返回 `200`：

```json
{ "vote": ReferendumVoteDto, "stats": ReferendumStatsDto }
```

### DELETE `/api/v2/referenda/{index}/votes/me`

幂等：未投票时同样返回成功。返回 `200`：

```json
{ "removed": true, "stats": ReferendumStatsDto }
```

## 2. 错误码映射

错误体统一为 `{ "message": string }`。

| 情况                                                     | HTTP |
| -------------------------------------------------------- | ---- |
| 缺失/无效/过期 Firebase Token                            | 401  |
| 非法 decision / points（非整数、小于 1）/ 非法查询参数   | 400  |
| 创建参数非法（标题、正文、origin、日期、门槛）           | 400  |
| pointsUsed 超过权威 pointsBalance                        | 403  |
| 非管理员执行管理员操作                                   | 403  |
| referendum 不存在                                        | 404  |
| 用户 Firestore profile 缺失（PR-3）                      | 404  |
| 非 Deciding 状态投票/撤票；`now >= votingEndsAt`         | 409  |
| 基础设施异常、损坏的 aggregate、Firestore 竞争等未知错误 | 500  |
| 用户 profile 的 pointsBalance 非安全非负整数（PR-3）     | 409  |

未知错误不得被映射为 409（PR-1 已修复：只有 `ReferendaServiceError`、
`VoteValidationError`、`CreationValidationError` 参与 4xx 映射）。

## 3. 时间与结果合同

- 投票窗口为半开区间：`votingStartsAt <= now < votingEndsAt`。`now == votingEndsAt` 视为已结束（已实现）。
- 最终结果判定使用精确整数交叉相乘：
  `ayePoints * 10000 >= approvalThresholdBps * (ayePoints + nayPoints)`（BigInt，已实现）。
  四舍五入后的 `approvalBps` 仅用于显示。
- 零分母（`ayePoints + nayPoints == 0`）时 approval 为 0，仅当 `approvalThresholdBps === 0` 且 turnout 达标才通过。
- abstain 计入 turnout，不计入 approval denominator。

## 4. 事务合同

- 投票/改票/撤票：单事务内完成 referendum、用户（权威 `pointsBalance`）、现有 vote、aggregate stats 的读取与写入；所有读先于所有写。
- 创建：`counters/referenda`、`referenda/{index}`、`referenda/{index}/stats/current` 在同一事务内写入；index 分配不使用 collection count 或 last-document 查询。
- 不变量：任何变更后，`referenda/{index}/stats/current` 必须等于由 votes 文档全量重算的结果（emulator 测试强制校验）。
- 损坏的 aggregate（会导致负计数器的状态）直接拒绝，不做 clamp。

## 5. 测试映射

| 合同                   | 测试                                                                                      |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| 响应形状与状态码       | `src/app/api/v2/referenda/__tests__/apiContract.test.ts`                                  |
| 公开 DTO 隐私          | `src/domain/dtos/__tests__/PublicVoteDtoPrivacy.test.ts`                                  |
| 事务/并发/幂等/不变量  | `tests/emulator/referendaService.test.ts`                                                 |
| 精确时间边界、精确结果 | `src/domain/services/__tests__/referendumValidation.test.ts`、`referendumOutcome.test.ts` |
| 安全规则               | `tests/firestore/rules.test.ts`                                                           |

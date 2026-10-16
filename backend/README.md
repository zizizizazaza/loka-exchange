# Backend

算力募资 v1 的后端服务。设计见 [算力募资 v1 后端设计](https://claude.ai/code/artifact/221b6102-b256-4dc3-9d25-4e032b50c497)。

细节文档：
- [docs/wallets-and-permissions.md](docs/wallets-and-permissions.md)：钱包、Privy 登录、多签、Keeper、页面数据来源
- [docs/kyb.md](docs/kyb.md)：KYB 流程（ID Analyzer）

后端不持有任何能转走资金的私钥。钱只在投资人钱包和合约之间流动，后端负责认证、上架、收集条件签名并提交上链、按时触发合约的公开函数、索引链上事件和对账。

## 技术栈

NestJS 12（ESM）+ TypeScript 6，PostgreSQL 18 + Prisma 7，Vitest，oxlint。之后会加 viem（链上交互）、Privy（登录）、Ponder（索引器）；Redis 任务队列等写 Keeper 时再加。

## 计划的结构

```
backend/
├── src/
│   ├── api/           按身份过滤字段的 REST 接口（OpenAPI）
│   ├── account/       SIWE 登录、机构和成员
│   ├── kyb/           认证服务商适配器、加白、制裁筛查
│   ├── listing/       上架申请、条款、还款计划
│   ├── document/      原件存储和 SHA-256 哈希
│   ├── attestation/   EIP-712 条件签名和中继
│   ├── monitoring/    Hetu 监控节点对接
│   ├── repayment/     应收、实收、对账、月度披露
│   ├── keeper/        到期调用合约公开函数
│   └── ops/           运营后台接口
└── indexer/           合约事件写入 Postgres（独立进程）
```

## 本地开发

1. 本机 PostgreSQL 里建两个库：`loka_exchange_dev`（开发）、`loka_exchange_test`（e2e 测试，每次运行会清空）。
2. 复制 `.env.example` 为 `.env`，填好连接串。`.env` 不提交。
3. 运行：

```bash
npm install          # 会自动生成 Prisma 客户端到 src/generated/（不提交）
npm run db:migrate   # 把迁移应用到开发库
npm run start:dev    # http://localhost:3000/api/health
npm test             # 单元测试
npm run test:e2e     # e2e 测试，连 TEST_DATABASE_URL
npm run lint
```

## 接口

| 接口 | 说明 |
|---|---|
| `GET /api/health` | 健康检查，会查一次数据库 |
| `POST /api/auth/session` | 前端每次 Privy 登录后、绑定新钱包后调用。需要访问令牌（`Authorization: Bearer` 或 cookie `privy-token`）和身份令牌（header 或 cookie `privy-id-token`）。创建或更新用户和钱包，返回用户资料 |
| `GET /api/me` | 当前用户资料：邮箱、钱包、所属机构和 KYB 状态、身份分层（`unverified` / `pending` / `verified`） |

| `GET /api/kyb` | 当前用户的 KYB 申请：状态、表单草稿、公司核查结果、申请人人脸结果（名单筛查结果不返回给申请人） |
| `PUT /api/kyb/draft` | 保存表单（每步切换时调用）。没有申请时会创建机构和申请 |
| `POST /api/kyb/company` | 上传注册证书（multipart，字段 `document`，PDF / JPEG / PNG / WebP，最大 10 MB），调 ID Analyzer `/kyb`，预填表单。**每次 10 个额度** |
| `POST /api/kyb/applicant/session` | 为申请人创建 DocuPass 人脸验证链接（**2 个额度**）；同一姓名和生日的未完成链接会复用 |
| `GET /api/kyb/applicant` | 轮询申请人人脸结果（后端去查 DocuPass） |
| `POST /api/kyb/submit` | 提交审核；不完整时返回 400 `NOT_READY` 和 `problems` 列表。提交后对申请人和名单上每个人做 `/amlv3` 姓名筛查，结果只给审核员看；筛查失败（例如免费账户不能用 `/amlv3`）记为未筛查，不影响提交 |
| `DELETE /api/kyb` | 仅开发环境：删除申请和机构，便于重测 |

KYB 接口都要登录。公司核查用 `IDANALYZER_API_KEY`；人脸验证和名单筛查用 `IDANALYZER_KYC_API_KEY`（没配就用前者），`IDANALYZER_KYC_PROFILE_ID` 必须是这把密钥所在账号下的配置文件。服务商出错返回 502 `PROVIDER_ERROR`（`providerCode` 是服务商的错误码，详细信息在后端日志），没配置密钥返回 503 `KYB_NOT_CONFIGURED`，已提交后再修改返回 409 `CASE_LOCKED`。

没有令牌或令牌无效返回 401，`code` 字段说明原因：`NO_TOKEN`、`INVALID_TOKEN`、`NO_IDENTITY_TOKEN`、`INVALID_IDENTITY_TOKEN`、`TOKEN_MISMATCH`。邮箱已属于另一个 Privy 用户时返回 409 `EMAIL_IN_USE`。

## 状态

已完成：项目骨架、配置校验、数据库、健康检查；Privy 登录（验证访问令牌和身份令牌，同步用户和钱包，Privy 授权给服务器代签的内置钱包会标记为 `delegated`，之后不予加白）；身份分层；KYB 申请（机构创建、公司核查、申请人人脸、提交，提交后后台做名单筛查；结果用轮询拿，见 [docs/kyb.md](docs/kyb.md)）。

下一步：运营审核（通过、拒绝、要求补材料）、合规钥链上加白、webhook、按身份过滤字段。

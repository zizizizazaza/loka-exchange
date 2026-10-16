# KYB 流程（ID Analyzer）

算力募资 v1。机构投资人通过企业认证（KYB）后，才能入金和认购（PRD 3.4）。服务商用 [ID Analyzer](https://www.idanalyzer.com/)，开发者文档在 [developer.idanalyzer.com](https://developer.idanalyzer.com)。登录和钱包部分见 [wallets-and-permissions.md](wallets-and-permissions.md)。

接口细节已在 2026-10-14 对照官方开发文档（[API v2 参考](https://developer.idanalyzer.com/help/id-analyzer-api-v2)、[KYB](https://developer.idanalyzer.com/help/verify-a-business-with-kyb)、[DocuPass](https://developer.idanalyzer.com/help/docupass-quickstart)、[AML](https://developer.idanalyzer.com/help/aml-search)、[Webhook](https://developer.idanalyzer.com/help/webhook-2)、[取结果](https://developer.idanalyzer.com/help/retrieving-transactions)）和官方 Node SDK `idanalyzer2@1.3.0` 核实。标「以文档为准」的地方是文档没写清楚、实现时要再确认的。

## 1. 总览

流程参考 Stripe 的企业认证：**一个人填完、一个人做人脸，其他人只做名单筛查，不够再要材料。** 前端原型在 `frontend/src/pages/verify/`（2026-10-14 按这个方案改过）。

| 页面步骤 | 填什么 | 怎么核验 | 服务 |
|---|---|---|---|
| Company | 先上传注册证书；公司名称、注册号、国家、地址、董事由证书自动读出，用户确认。再补机构类型、业务和资金来源、网站（可选） | 读证书并比对注册处；注册处查不到时转人工核对 | ID Analyzer `/kyb` |
| You | 先做证件 + 自拍 + 活体；姓名、生日、国籍从证件读出自动填写，不可修改。用户只补职位、持股比例、是否董事 | 人脸只能在手机上做，电脑上显示二维码 | ID Analyzer DocuPass（嵌入页面） |
| Owners | 董事和持股 25% 及以上的人：姓名、生日、国籍、持股比例。证书读出的董事自动预填；申请人本人如果在列，不重复填写。最后勾选「名单完整」声明 | 提交后由后台做姓名筛查（制裁、PEP），结果给审核员；本人不用做任何事，筛查失败也不影响提交 | ID Analyzer `/amlv3`（仅付费账户） |
| Addresses | 投资钱包（不能是 delegated 钱包）、公司控制的出金地址 | 投资钱包审核通过后加白；出金地址由用户在链上登记，24 小时后生效 | `Registry.addInvestor`、`AIUSDGateway.registerAddress` |
| Review | 汇总，两项声明，提交 | 提交后进入平台审核 | 运营后台 |

只有在筛查命中、或审核员认为需要时，才给某位董事或股东发 DocuPass 链接，让他本人验证。发之前先通知申请人。

证件、自拍、公司文件都存在 ID Analyzer。我们只存交易编号、结论、警告码和必要的公司及人员信息。

## 2. 状态

一个机构一条 KYB 记录（`kyb_cases` 表）。公司核查、申请人人脸、名单筛查都在填表过程中完成，提交后统一由平台审核。

```
未开始 → 填写中 → 已提交（平台审核）→ 已通过
                        ↓      ↑
                    待补充材料 ─┘
                        ↓
                      已拒绝
```

| 内部状态 | 进入条件 | 页面显示（原型左下角四种之一） |
|---|---|---|
| `not_started` | 已登录，没开始填 | 已登录、未认证 |
| `in_progress` | 开始填写，未提交（草稿和各项检查结果存在后端） | 已登录、未认证 |
| `submitted` | 已提交，等平台审核 | 审核中 |
| `info_requested` | 审核员要求补材料：某人的 DocuPass、注册证书、股权结构等 | 审核中（显示要补什么） |
| `approved` | 审核通过，且投资地址已加白 | 已认证 |
| `rejected` | 审核拒绝，或任一检查结论为 `reject` | 已登录、未认证（显示拒绝原因和重新提交入口） |
| `suspended` | 定期复查命中制裁名单，或认证过期 | 已登录、未认证 |

原型里写的「通过后邮件通知」，在进入 `approved`、`rejected`、`info_requested` 时发邮件。

## 3. 流程

### 第 1 步：公司核查（Company）

1. 机构上传注册证书（营业执照、公司注册证书等，图片或 PDF）。后端调用：

   ```
   POST https://api2.idanalyzer.com/kyb
   X-API-KEY: <API 密钥>
   Content-Type: application/json

   { "document": "<base64、data URL 或 https 链接>", "profile": "<可选>" }
   ```

   只有这两个字段，**`document` 必填**，公司名、注册号、国家、董事都从文件里读。不能只传注册号查询（官网营销页说可以，但开发文档和 SDK 都不支持；如果需要，找 ID Analyzer 确认），也没有单独的注册处查询接口。`profile` 可选，可用预设 `security_medium` 等。每次 10 个额度。EU 数据驻留用 `https://api2-eu.idanalyzer.com`。
2. 返回里直接带结论（示例耗时约 5 秒，SDK 超时 120 秒），按同步处理。保存：
   - `transactionId`、`decision`（accept / review / reject）、`warning[]`（每条有代码、严重度、导致的结论）
   - `data`：法定名称、注册号、税号、LEI、国家、地址、成立日期、主体类型、状态
   - `registry`：来源、是否找到、是否存续、按注册号还是名称匹配。**注册处查不到时没有这个对象**，结论只基于文件分析
   - `directorsToVerify[]`：`{ role, name, nameLocal }`，角色有 director、officer、shareholder、beneficial_owner、authorized_signatory，可能带 `ownershipPercent`（只在帮助文章里提到，以实际返回为准）
3. 把 `data` 预填到表单让用户确认，`directorsToVerify` 预填 Owners 步骤。用户改过的字段要记下，审核时显示和证书读出值的差异。
4. 按结果处理：
   - 有 `registry` 且匹配、存续 → 正常继续。
   - 没有 `registry`（警告 `BUSINESS_NOT_FOUND`）→ 可以继续，提交后由审核员人工核对证书。机构投资人金额大，不只凭文件放行。
   - `review` 类警告（`BUSINESS_NAME_MISMATCH`、`DOCUMENT_LOW_CONFIDENCE`、`ENTITY_CRIME_MATCH`、`ENTITY_PEP_MATCH`）→ 可以继续，审核时重点看。
   - `reject` 类警告（`UNRECOGNIZED_BUSINESS_DOCUMENT`、`DOCUMENT_LIKELY_INVALID`、`BUSINESS_DISSOLVED`、`ENTITY_SANCTION_MATCH`）→ 页面提示，不能继续；前两种允许换文件重传。

注册处覆盖哪些国家，官方没有列表，要按第一批机构所在国家问 ID Analyzer。

### 第 2 步：申请人人脸核验（You）

1. 后端创建 DocuPass 会话：

   ```
   POST https://api2.idanalyzer.com/docupass
   { "profile": "<KYC profile ID>", "mode": 0, "version": "3", "customData": "<kyb case id>" }
   ```

   `mode` 0 = 证件 + 人脸。`version` 一定显式传 3（文档对默认版本说法不一致）。返回 `url`、`qrCode`（base64 图片）、`reference`、`expiry`。创建链接时就扣额度：模式 0 是 2 个。链接只能用一次。
2. 前端用 iframe 或官方弹窗脚本（`https://v.idanalyzer.com/js/docupassembed.js`）嵌入页面。iframe 要在 profile 里打开 `allowIframe`。**人脸只能在手机上做**，电脑上会提示扫二维码，用户在手机上完成后页面自动更新。
3. **需要自建一个 KYC profile**：DocuPass 用的 profile 在官方 SDK 里是必填的，而且 webhook 地址、验证后的跳转地址（acceptUrl / reviewUrl / rejectUrl / expireUrl）、`allowIframe`、链接有效期都只能在 profile 里配置。ID 填进 `.env` 的 `IDANALYZER_KYC_PROFILE_ID`。
4. 结果拿法见第 4 节：开发阶段轮询，上线用 webhook 加轮询兜底。
5. 完成后从 `finalTransaction.data` 读 `fullName`（或 firstName + lastName）、`dob`、`nationalityFull`（没有就用 `countryFull`），写进表单。证件读出的字段以后保存表单时都以证件为准，不能改；证件上没有的字段（例如中国身份证没有国籍）由用户补填。申请人不先填姓名，所以不传 `verifyName` / `verifyDOB`；给董事、股东发的补充验证链接才传，用来核对。
6. `accept` → 可以继续；`review` → 可以继续，提交后由审核员看；`reject` → 允许重试（有次数上限），过期（警告 `DOCUPASS_EXPIRED`）不算拒绝。

### 第 3 步：董事和股东名单（Owners）

1. 名单规则：全部董事，加上直接或间接持股 25% 及以上的人。门槛待合规确认。申请人本人如果是董事或持股达到门槛，自动算在名单里，不再重复填写。
2. 申请人必须勾选「名单完整」声明。后端保存声明内容和时间。
3. 这一步只收集名单，**不当场筛查**，申请人不用等，也不会因为筛查出错被卡住。

### 姓名筛查（提交后，后台进行）

1. 提交成功后，后端对申请人和名单上每个人调用 `POST /amlv3`，参数只有 `text`（姓名或证件号）、`limit`、`page`，**不能按生日和国籍过滤**。返回的每条记录带 `score` 和实体信息（别名、类别如 `role.pep`、生日、国籍、来源）。我们用申请人填的生日和国籍和这些字段比对，排除同名误报（规则在 `screening.ts`）。
2. 结果只给审核员看，申请人页面不显示。命中的人由审核员判断：误报就忽略并写理由；需要核实就进入 `info_requested`，给这个人发 DocuPass 链接。
3. 某个人筛查失败（服务商不可用，或账户不能用这个接口）时记为 `not_screened`，不影响提交。审核员在后台重跑或人工查。
4. **`/amlv3` 只对付费客户开放**（2026-10-14 实测，免费账户返回 422 `ERROR_OPERATION_FAILED`: "This service is available for paid customer only."），价目表写的「非订阅用户 1 个测试额度」并不成立。开通付费套餐前，所有名单都会是 `not_screened`。

### 第 4 步：提交和平台审核

1. 提交后进入 `submitted`。运营后台列出所有待审核的机构，显示公司信息、注册处结果、申请人人脸结论、每个人的筛查结论和所有警告；ID Analyzer 的原始文件通过其后台链接查看。
2. 审核员可以：通过；拒绝并写理由；要求补材料（某人的 DocuPass、注册证书、股权结构图）。每个操作记入 `audit_log`。
3. 通过前，用 `GET /transaction/{id}` 重新拉一次公司和申请人的结果，确认和本地记录一致。不只凭 webhook 或前端放行。这个接口免费。

### 第 5 步：加白

1. 合规钥对机构的每个投资地址调用 `Registry.addInvestor(地址, kybRef)`，`kybRef` 用公司核查 `transactionId` 的哈希。
2. 链上交易成功后，状态改为 `approved`，发邮件通知。
3. 机构之后新增投资地址，不用重做 KYB，由机构管理员在页面上申请，后端加白并记录操作人。

## 4. 拿结果：轮询和 Webhook

公司核查（`/kyb`）和姓名筛查（`/amlv3`）同步返回，不需要 webhook。只有 DocuPass（申请人人脸，以及审核员要求的补充验证）要等用户操作完才有结果，两种拿法：

| 方式 | 什么时候用 |
|---|---|
| 轮询 | 本地开发和低量阶段。前端在人脸页面等待时，后端每几秒调 `GET /docupass/{reference}` 查一次（返回 `decision`、`transactionId`、`completedAt`、完成后的完整结果）；后台定时任务用 `GET /docupass?decision=...` 每几分钟扫一遍未完成的会话。不需要公网地址 |
| Webhook | 上线后用，结果实时到达。轮询保留为兜底，防止 webhook 丢失 |

下面是 webhook 的做法。


| 项目 | 做法 |
|---|---|
| 配置 | 在 KYC profile 的 General 里填写 webhook 地址，必须是公网 HTTPS。后台可以在 48 小时内手动重发 |
| 事件 | `new`、`update`、`delete`、`docupass_conclusive`。只有后两种会改变我们的状态 |
| 验签 | 请求头 `X-IDA-Signature: v1=<hex>` 和 `X-IDA-Timestamp`。计算 `"v1=" + HEX(HMAC_SHA256(密钥, 时间戳 + "." + 原始请求体))`，用常量时间比较。密钥在后台 API Keys → Webhook Signing Secret |
| 原始请求体 | 必须用未解析的原始字节计算签名。NestJS 要为这个路由单独开 raw body，不能先 JSON 解析再序列化 |
| 时间 | 时间戳与当前时间相差超过 5 分钟，拒绝 |
| 响应 | 10 秒内返回 200。验签通过后先写入队列再返回，处理放在队列里做 |
| 重复和乱序 | 失败会重试 4 次（约 10 分钟、1 小时、12 小时、24 小时后），可能重复，也可能乱序。用 `transactionId` + `event` 去重；状态只按「更严重的结论优先」推进，不会被晚到的旧事件改回去 |

## 5. 认证之后

| 情况 | 处理 | 谁来做 |
|---|---|---|
| 定期复查（PRD 4.6.5 #21） | 每 30 天（待合规确认）用 `/amlv3` 复查机构和必需人员 | 后端定时任务 |
| 复查命中制裁名单 | 状态改为 `suspended`；后端生成 `Registry.freezeInvestor` 的多签提案，运营多签执行。冻结后不能认购、入金、出金、领取，应收照常累计 | 合规钥不能冻结，只能多签 |
| 复查命中 PEP 或犯罪名单 | 转人工审核，不自动冻结 | 运营 |
| 认证到期需重做 | 状态改为 `suspended`，合规钥调用 `Registry.removeInvestor`。移除后不能再认购和入金，已有应收照常可领 | 后端 |

## 6. 存储

`kyb_cases`（机构一条；`draft` 字段存申请人填的整张表单，包括董事和股东名单）、`kyb_checks`（每次 `/kyb`、每次 DocuPass、每个人的 `/amlv3` 筛查一条，记录当时用的姓名和生日；表单里姓名或生日改了，旧结果就不算数）、`kyb_events`（webhook 原文，用于审计和去重）。

只存：ID Analyzer 的 `transactionId`、结论、警告码、公司的登记信息、人员姓名和角色。不存证件图片、自拍和公司文件原件；要看原件，去 ID Analyzer 后台。

## 7. 代码结构

`backend/src/kyb/` 里分两层，换服务商只换第二层：

| 层 | 内容 |
|---|---|
| 流程层 | `kyb.service.ts`（申请、各项检查、提交）、`draft.ts`（表单结构和提交校验）、`screening.ts`（名单匹配规则）。之后加：人工审核、加白、通知 |
| 服务商适配器 `KybProvider`（`provider.ts`） | `verifyCompany(document)`、`createPersonSession(person)`、`getPersonSession(reference)`、`searchAml(name)`。实现是 `idanalyzer.provider.ts`；测试里用假的服务商（`test/kyb.e2e-spec.ts`）。之后加 `verifyWebhook`、`getTransaction` |

API 密钥和 webhook 签名密钥放在密钥管理服务里，不进代码和 `.env` 提交。

## 8. 待确认

| # | 问题 | 谁定 |
|---|---|---|
| 1 | ID Analyzer 是否满足 PRD 3.2「持牌第三方」的要求，在目标地区是否被认可（PRD 3.5 #11） | 律师、业务 |
| 2 | 第一批机构所在国家的注册库是否覆盖 | 业务问 ID Analyzer |
| 3 | 受益所有人的持股门槛（先按 25%）；董事和股东只做姓名筛查是否足够，哪些情况必须本人核验 | 合规 |
| 4 | AML 复查频率（先按 30 天）；认证有效期 | 合规 |
| 5 | `/kyb` 能否只用公司名和注册号查询（营销页说可以，开发文档说不行）；DocuPass 能否用预设 profile；链接默认有效期 | 问 ID Analyzer |
| 6 | 数据驻留选美国还是欧盟 | 合规 |
| 7 | 费用：公司核查 10 额度一次，DocuPass 证件 + 人脸 2 额度一次，`/amlv3` 订阅后免费。免费账户 100 测试额度（官网一处说一次性、一处说每月）。付费档 $89/月 1,000 额度起 | 业务 |

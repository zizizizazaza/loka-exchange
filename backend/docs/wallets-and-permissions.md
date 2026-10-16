# 钱包、权限与前后端分工

算力募资 v1。补充 [后端设计](https://claude.ai/code/artifact/221b6102-b256-4dc3-9d25-4e032b50c497)，写的是开发时容易搞错的细节。合约以 `contracts/` 里的代码为准，函数名都可以在里面找到。

## 1. 基本原则

- **读走后端，动钱走钱包。** 页面上的数字、列表、状态都来自后端 API（链上事件 → 索引器 → 数据库 → API），前端不直接读链。只有动钱的操作才由用户钱包直接调用合约。
- **后端没有能转钱的私钥。** 资金只在用户钱包和合约之间流动。后端持有的三把钥匙都不能动钱，见第 3 节。
- **托管解决的是信任问题。** 认购款在托管合约里，规则写死，平台挪不动。这是 PRD 的第一条原则，也是和 USD.AI 的主要区别。认购不能改成由后端代收。

前端需要调合约的地方只有三处：

| 操作 | 合约函数 | 页面 |
|---|---|---|
| 认购、撤回 | `LoanEscrow.subscribe` / `withdraw` | Markets 详情页的认购框；Portfolio 的托管列表 |
| 入金、出金 | `AIUSDGateway.mint` / `redeem` | Deposit |
| 登记出金地址 | `AIUSDGateway.registerAddress` | Deposit（出金方向） |

认购前要先对托管合约 `approve` AIUSD，入金前要先对网关 `approve` USDC。

## 2. 用户钱包和登录

登录和连接钱包用 [Privy](https://docs.privy.io)。平台不保管用户私钥。

原型的登录方式是「Email or wallet」，两种都支持（决定于 2026-10-14）：

- **钱包登录**：MetaMask、Coinbase Wallet、Rainbow 等，或通过 WalletConnect（Privy 的 `wallet_connect` 选项）连接手机钱包和机构托管（如 Fireblocks）。用户的投资地址就是这个钱包。
- **邮箱登录**：登录时 Privy 自动为没有钱包的用户创建一个内置钱包（Privy 的 createOnLogin 配置，实现时以文档为准）。用户的投资地址就是这个内置钱包。

KYB 通过后，合规钥把用户的投资地址加进白名单。之后入金、认购都从这个地址发出。

**邮箱用户怎么入金**：内置钱包一开始是空的。用户要先从自己的托管账户或交易所，往内置钱包地址转入 USDC 和少量 BNB（付 gas），再在 Deposit 页把 USDC 换成 AIUSD。Deposit 页和 Portfolio 要显示内置钱包地址，方便复制。出金仍然只能打到登记过的地址，一般是机构自己的托管账户。

**邮箱用户的安全**：内置钱包由一个人的邮箱登录控制，金额可能很大。上线前要在 Privy 里开启多因素认证（MFA），并在 KYB 时提示机构：大额资金建议用机构自己的钱包登录。

**登录流程**

1. 前端用 Privy React SDK 登录。连接外部钱包时，Privy 底层走 SIWE（EIP-4361）：钱包签一段登录文本，不发交易，不花 gas。
2. 前端调后端接口时带上 Privy 的访问令牌（`Authorization: Bearer`，或 HTTP-only cookie `privy-token`）。
3. 后端用 `@privy-io/node` 验证：`privy.utils().auth().verifyAccessToken({ access_token })`。令牌是 ES256 签名的 JWT，约 1 小时过期；验证失败一律按未登录处理。构造 `PrivyClient` 时传入 `jwtVerificationKey`，可以省掉每次去 Privy 取公钥的请求。
4. 后端用身份令牌拿用户绑定的钱包：`client.users().get({ id_token })`，从 `linked_accounts` 里取钱包地址（外部钱包和内置钱包都在里面）。身份令牌要先在 Privy 控制台打开。
5. 一个机构可以绑定多个钱包地址，认证状态按机构算，白名单按地址写。

**同一个邮箱只对应一个账号**

数据库按 Privy 用户 ID 识别用户，不按邮箱。合并发生在 Privy：控制台的「按邮箱合并账户」（`merge_accounts_by_email`）已开启，同一个人先用邮箱、再用同一邮箱的谷歌登录，Privy 认作同一个用户，只有一个内置钱包。

后端兜底：登录时如果这个邮箱（统一小写）在数据库里已经属于另一个 Privy 用户，说明 Privy 没有合并。这时不在数据库里合并（合并不了两个内置钱包，资金会分散），也不新建账号，而是返回 409 `EMAIL_IN_USE` 并记审计日志，前端提示用户用原来的方式登录。数据库对邮箱有唯一约束。

用户的邮箱取自邮箱登录；没有邮箱登录时取谷歌账号的邮箱。

**内置钱包只归用户所有**

Privy 允许把平台服务器的授权密钥设为钱包的共同所有者（2-of-2 key quorum）。这样配置后平台能操作用户钱包，违背「平台不经手资金」。所以内置钱包的所有者只能是用户本人，平台不加授权密钥。

**gas 由用户自己付**

不开 Privy 的 gas 代付。认购、入金、出金、登记地址这些交易，由用户钱包自己付 BNB。

- 外部钱包的用户一般已有 BNB。
- 邮箱登录生成的内置钱包一开始没有 BNB，没法发交易。前端在用户第一次发交易前检查 BNB 余额，不够就提示先转入少量 BNB。
- 平台自己付的 gas 只有 Keeper 钱包那部分：代为提交条件签名、放款、退款、结算、分钱。这是平台的运营成本，不是替用户代付。

不开代付还有一个好处：开了代付的 Privy 钱包会被 EIP-7702 升级成合约，签名要改用 ERC-1271 模式，签放款条件时容易出错。

**待实测**：机构用 Safe 通过 Privy 登录。Privy 文档没有说明合约钱包能否走 SIWE 登录（需要 ERC-1271 验签）。第一家用 Safe 的机构接入前要先实测。

**身份状态（原型左下角的四种）**

| 状态 | 判断依据 |
|---|---|
| 公开 | 未登录 |
| 已登录、未认证 | 有会话，没有 KYB 申请 |
| 审核中 | 有 KYB 申请，服务商还没出结果，只存在后端 |
| 已认证 | KYB 通过，且合规钥已调用 `Registry.addInvestor` 把该地址加白 |

KYB 的完整流程和状态见 [kyb.md](kyb.md)。

收益率、条款、文件只在「已认证」时由 API 返回。原型目前只是在前端隐藏，正式实现必须在 API 层过滤。

## 3. 平台的钥匙

| 钥匙 | 是什么 | 谁持有 | 能做 | 不能做 |
|---|---|---|---|---|
| 运营多签 | Safe 多签钱包 | 平台几位负责人，各用自己的钱包（主网用硬件钱包） | 见第 4 节清单 | 转走任何合约里的钱 |
| 合规钥 | 普通地址，私钥在云 KMS | 后端 kyb 模块 | `Registry.addInvestor` / `removeInvestor` | 冻结、动钱 |
| Keeper 钱包 | 热钱包，只放 gas | 后端 keeper 模块 | 调用对所有人开放的函数，见第 6 节 | 没有任何特权 |
| 平台签名钥 | 普通地址，私钥在 KMS | 后端 attestation 模块 | 签条件 4（三方协议）里平台那一份 | 单独完成任何条件、动钱 |

合规钥由多签通过 `Registry.setCompliance` 设置和轮换。平台签名钥需要先由多签用 `Registry.setSigner(地址, "PLATFORM", true)` 登记。

## 4. 运营多签

**怎么和合约结合**：Safe 本身是链上的一个合约。部署时把 Safe 地址传给 `Guardian` 构造函数；之后所有需要平台出手的函数都只检查 `msg.sender == guardian.multisig()`。合约里没有任何 Safe 专用代码。

**一次操作的流程**

1. 运营后台生成交易提案，通过 Safe Transaction Service（Safe{Core} SDK）提交，例如「调用 `CollectionVault(0x…).declareDefault(原因哈希)`」。
2. 多签成员在 Safe 网页或 App 里逐个确认。
3. 确认数达到门槛后执行。合约看到的调用者是 Safe 地址，校验通过。

运营后台负责生成提案、显示待确认的操作、记录依据（原因哈希对应的原文存在后端）。不要让运营手工拼 calldata。

**门槛**：测试网先用 2/3，主网建议 3/5。

**注意**：`Guardian.multisig` 是部署时写死的（immutable）。换成员、改门槛要在 Safe 内部操作（Safe 的 owner 管理），Safe 地址不变。不要为了换人去换 Safe 地址，那需要重新部署 Guardian。

**多签能调用的函数（完整清单）**

| 合约 | 函数 | 用途 |
|---|---|---|
| Guardian | `pause` / `unpause` | 暂停认购、放款、入金、出金（PRD 4.6.5 #19、#20） |
| Registry | `freezeInvestor` / `unfreezeInvestor` | 认证失效或命中制裁名单（#21） |
| Registry | `setSigner` | 登记律所、估值方、买家、算力中心、监控节点、平台签名钥 |
| Registry | `setRentChannel` | 登记收租通道；融资方要提前还款时也要登记，才能入金拿到 AIUSD |
| Registry | `setCompliance` | 设置、轮换合规钥 |
| AIUSDGateway | `setFactory` | 部署时调用一次 |
| LoanFactory | `createLoan` | 上架一笔贷款 |
| LoanEscrow | `cancel` | 放款前取消项目，全额退款（#3） |
| LoanEscrow | `revokeAttestation` | 撤销一条可疑的条件证明（#6；签名方自己也可以撤） |
| CollectionVault | `declareDefault` | 依据链下事实宣布违约（#10、#12、#13、#16） |
| CollectionVault | `recordDisposition` | 违约处置每一步的文件哈希上链 |

一笔贷款正常走完，多签只用一次（上架）。其余都是出问题时才用。

## 5. 外部签名方

律所、估值方、买家、算力中心、监控节点用各自的钱包签名，普通钱包和 Safe 都可以，合约用 OpenZeppelin `SignatureChecker` 同时支持 ECDSA 和 ERC-1271。

- 签名方地址必须先由多签登记（`Registry.setSigner`），上架时写进该笔贷款的条件设置，之后不能改。
- 签的是 EIP-712 结构化数据。条件证明的域是 `name "Loka Loan Escrow", version "1", verifyingContract = 该笔托管合约`；在线率报告的域是 `name "Loka Collection Vault", version "1", verifyingContract = 该笔收款合约`。可以直接调合约的 `eip712Domain()` 拿到。
- 待签数据的摘要可以用 `LoanEscrow.hashAttestation` / `CollectionVault.hashUptimeReport` 核对。
- **签名数组按签名方顺序排列**：`signatures[i]` 是第 i 个签名方的签名，没签的位置传空字节。长度必须等于签名方人数。
- 后端收齐签名后，由 Keeper 钱包代为提交 `attest` 或 `recordUptime`，签名方自己不用付 gas。

## 6. Keeper 要做的事

都是对所有人开放的函数，Keeper 只负责按时调用。

| 时机 | 调用 | 说明 |
|---|---|---|
| 某笔贷款 6/6 条件满足 | `LoanEscrow.release` | 放款 |
| 认购截止或放款截止已过、没走完 | `LoanEscrow.expire`，然后 `refundBatch` | 退款直接打回每个认购人 |
| 每个还款日之后 | `CollectionVault.settle` | 一次结一期，迟到时连续调用 |
| 每次 settle 之后 | `CollectionVault.claimFor(全部持有人)` | 页面没有「领取」按钮，还款要自动进持有人余额；被冻结的持有人会被跳过 |
| 补救期截止之后 | `CollectionVault.checkCure` | 恢复或转为违约 |
| 融资方有待付金额时 | `CollectionVault.payOperator` | 换成 USDC 打给融资方 |

## 7. 页面和数据来源

| 页面 | 显示 | 来源 |
|---|---|---|
| Markets | 统计、募资卡片、Funded 列表、详情页三个页签 | 后端 API（索引器数据 + 条款） |
| Markets | Subscribe、Withdraw | 用户钱包 → `LoanEscrow` |
| Portfolio | AIUSD 余额、持仓份额、托管中的认购 | 后端 API（也可直接读链核对） |
| Deposit | 入金、出金、登记地址 | 用户钱包 → `AIUSDGateway` |
| Issue | 说明和申请入口 | 不涉及合约；申请走后端 |

还款记录里的「应收租金」（Rent due）不在链上，合约只知道每期应还多少。这个数字由后端从条款里取。

## 8. 原型和合约的差异（开发时按右列做）

| 差异 | 做法 |
|---|---|
| 页面没有领取按钮，合约是持有人领取 | Keeper 每期结算后调用 `claimFor`，见第 6 节 |
| Positions 显示价格和未实现盈亏（二级交易的概念） | v1 改成剩余本金和已收还款 |
| Deposit 可选三条链 | 先只部署 BSC 测试网（本地开发用 Hardhat 本地链），页面只留一条 |
| 页面上的示例贷款 | 部署脚本要造出示例贷款并模拟放款和几期还款 |

## 9. 部署顺序

1. 在目标链上创建运营 Safe，确定成员和门槛。
2. 部署 `Guardian(Safe 地址)`。
3. 部署 `Registry(Guardian, 合规钥地址)`。
4. 部署 `AIUSDGateway(USDC, Registry, Guardian)`，它会同时部署 AIUSD。测试网的 USDC 用 `MockUSDC`。
5. 部署三个实现合约 `LoanEscrow`、`CollectionVault`、`LoanShares`，再部署 `LoanFactory`。
6. 由 Safe 调用 `AIUSDGateway.setFactory(LoanFactory)`。
7. 由 Safe 登记签名方（`setSigner`）和收租通道（`setRentChannel`）。
8. 由 Safe 调用 `LoanFactory.createLoan` 上架第一笔贷款。

# Contracts

算力募资 v1 的智能合约，审计范围就是这个文件夹。规则来自 `PRD-算力募资-v0.2.md` 第四节，后端设计见 [算力募资 v1 后端设计](https://claude.ai/code/artifact/221b6102-b256-4dc3-9d25-4e032b50c497)。

托管合约自己写，不依赖 Atara。接口按 `ILoanEscrow` 抽象，以后如果改用 Atara，只换实现。

## 合约

| 合约 | 部署 | 作用 | 接口 |
|---|---|---|---|
| LoanFactory | 全局一个 | 部署每笔贷款的三个合约，参数写死 | `ILoanFactory` |
| Registry | 全局一个 | 认证机构白名单、签名方和收租通道登记 | `IRegistry` |
| AIUSD 网关 | 全局一个 | USDC 和 AIUSD 1:1 互换，出金只到登记地址 | `IAIUSDGateway` |
| Guardian | 全局一个 | 多签暂停；只能停入口，不能转钱 | `IGuardian` |
| LoanEscrow | 每笔贷款一个 | 存认购款；6 条条件齐了放款，否则退款 | `ILoanEscrow` |
| CollectionVault | 每笔贷款一个 | 收租、准备金、按序分钱，补救和违约 | `ICollectionVault` |
| LoanShares | 每笔贷款一个 | 持有人份额，v1 不可转让 | `ILoanShares` |

## 目录

```
contracts/
├── contracts/
│   ├── types/LoanTypes.sol   共用的状态、条件编号、EIP-712 结构、贷款参数
│   ├── interfaces/           上面 7 个合约的接口
│   ├── Guardian.sol  Registry.sol  AIUSD.sol  AIUSDGateway.sol
│   ├── LoanFactory.sol  LoanEscrow.sol  LoanShares.sol
│   ├── CollectionVault.sol
│   ├── libraries/SignerSet.sol   托管和收款合约共用的签名校验
│   └── mocks/                测试用 USDC 和合约钱包
├── test/
│   ├── LoanEscrow.t.sol      托管、条件签名、放款、退款、工厂
│   ├── CollectionVault.t.sol 收租、分钱、补救、违约、提前还款、领取
│   └── utils/LoanTestBase.sol  部署整套合约并上架一笔贷款
├── hardhat.config.ts
└── package.json
```

## 常用命令

```bash
npm install
npx hardhat build              # 编译
npx hardhat test solidity      # 跑 Solidity 测试
```

**本地链**（开发联调用，节点关掉数据就没了）：

```bash
npx hardhat node                                          # 终端 1，保持运行
npx hardhat run scripts/deploy.ts --network localhost     # 终端 2：部署，地址写到 deployments/localhost.json
npx hardhat run scripts/seed-demo.ts --network localhost  # 造出和交易所原型一致的 4 笔贷款
```

`seed-demo` 之后链上有：NH200-1、AUS-H100 已放款并还了 7 期；FRA-H100 募资中 62%；DAL-B200 已募满、条件 4/6。它会把链上时间往前拨约 7 个月来模拟还款。账户分工写在脚本开头。

**BSC 测试网**（chain id 97，代替 Base Sepolia）：

```bash
npx hardhat keystore set BSC_TESTNET_RPC_URL
npx hardhat keystore set BSC_TESTNET_PRIVATE_KEY
npx hardhat run scripts/deploy.ts --network bscTestnet
```

私钥只放进 keystore，不要写进代码或 `.env` 提交。不设 `MULTISIG` 时，多签权限给部署地址，只适合测试网。

## PRD 异常情况由谁处理

PRD 4.6 的 24 种异常，在合约里的处理位置。「链下」表示合约只负责记录结果。

| # | 情况 | 处理 |
|---|---|---|
| 1 | 认购截止没募满 | `LoanEscrow.expire` → 退款 |
| 2 | 投资人撤回 | `LoanEscrow.withdraw` |
| 3 | 上架后发现重大问题 | `LoanEscrow.cancel`（多签） |
| 4 | 放款条件迟迟不齐 | `LoanEscrow.expire` → 退款 |
| 5 | 设备验证不通过 | `LoanEscrow.attest` 校验条件 5 的 GPU 数量，不符就提交不了 |
| 6 | 已签的证明造假或撤回 | `LoanEscrow.revokeAttestation`，然后重签 |
| 7 | 买家迟付或少付 | `CollectionVault.settle` 动用准备金，暂停服务费和融资方分成 |
| 8 | 准备金用尽仍不够 | `CollectionVault.settle` 记欠款，下期优先补 |
| 9 | 覆盖倍数低于 1.15 | `settle` 转入 Cure，`checkCure` 判断恢复或违约 |
| 10 | 设备长时间离线 | 链下判断，`declareDefault`（多签） |
| 11 | 监控数据缺失 | 链下切换备用节点；`recordUptime` 只记录 |
| 12 | 重估超过 85% | 链下判断，`declareDefault`（多签） |
| 13 | 买家提前终止或破产 | 准备金先顶；链下找新买家，不成则 `declareDefault` |
| 14 | 融资方提前还款 | `CollectionVault.prepay` |
| 15 | 违约处置 | `declareDefault` / `checkCure`，`depositRecovery`，`recordDisposition` |
| 16 | 融资方私收租金 | 链下判断，`declareDefault`（多签） |
| 17 | 算力中心破产 | 链下处置（SPV 破产隔离），所得走 `depositRecovery` |
| 18 | 处置后仍不够 | `depositRecovery` 按份额分配，差额由持有人承担 |
| 19 | 合约漏洞或被攻击 | `Guardian.pause`（多签），只停入口 |
| 20 | USDC 脱锚 | `Guardian.pause(PAUSE_MINT \| PAUSE_REDEEM)` |
| 21 | 投资人认证失效或被制裁 | `Registry.freezeInvestor`，应收照常累计 |
| 22 | 持有人收款地址失效 | 持有人主动 `claim`，钱一直留在合约里 |
| 23 | 平台确认条件出错 | 链下，赔付方式待定 |
| 24 | 分配后的零头 | 到期时剩余资金（含准备金）计给融资方 |

## 需要产品确认

- 每期分配顺序：持有人 → 补准备金 → 服务费 → 融资方。PRD 只写了「持有人 → 服务费 → 融资方」。
- 补救期内付完持有人、补完准备金、扣完服务费后剩下的钱先留在合约里：补救成功就给融资方，违约就给持有人。
- 只要某期覆盖倍数低于 1.15 就立刻进补救期（和 PRD 违约示例一致）。PRD 4.6.3 #7 写的是「准备金用到第 2 个月仍未补回才进补救期」，两处不一致。
- 到期后剩下的准备金退给融资方。
- 违约后利息按年利率从最后一个还款日起单利计算，处置期间继续计息。
- 提前还款金额 = 剩余本金 + 欠的利息 + 下一期利息 + 本金 × 1% 提前还款费。
- 融资方要持有 AIUSD 才能提前还款，目前做法是把融资方钱包登记为收租通道。
- 还款日按「放款时间 + k × 每期长度」计算，不对齐自然月。
- 放款时逐个铸造份额，所以每笔贷款要设认购人数上限（`maxSubscribers`）。
- 覆盖倍数线 1.15 意味着月租金至少要是月供的 1.15 倍，否则一放款就会进补救期。上架时要检查。

## 状态

| 合约 | 状态 |
|---|---|
| Guardian、Registry、AIUSD、AIUSDGateway | 已实现 |
| LoanFactory、LoanEscrow、LoanShares | 已实现 |
| CollectionVault | 已实现 |

53 个测试通过：
- 托管（35 个）：认购、撤回、6 条条件签名（门槛不足、签错人、过期、估值不足、GPU 数量不符、撤回后重签、合约钱包签名）、放款、两种截止退款、多签取消、暂停、份额不可转让、出金地址 24 小时生效、工厂参数校验；模糊测试「托管余额始终等于认购总额」。
- 收款（18 个）：正常分钱、跑完全部期数到期、Keeper 迟到补结算、缺租动用准备金进补救期、补救成功、补救期内留存余额、补救失败自动违约、多签宣布违约、处置款先还持有人再给融资方、处置不足按份额分担、提前还款、冻结持有人、在线率签名；模糊测试「任何租金序列下，合约余额都等于它欠各方的钱」。

部署脚本已完成，本地链已验证。还没做：BSC 测试网部署；审计。

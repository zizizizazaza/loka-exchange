# Frontend

Loka 的前端，三个页面一起部署（Vercel 一个项目），地址和原型 `v2-exchange/` 一致：

| 地址 | 页面 | 给谁用 | 实现 |
|---|---|---|---|
| `/` | 官网落地页 | 所有访客 | 静态 HTML，从 `v2-exchange/index.html` 原样复制（只把图片路径改成 `/assets/`） |
| `/app/` | 交易所 App | 投资机构 | React 19 + Vite + TypeScript |
| `/app/issuer/` | 发行方控制台 | 算力中心（借款方） | React |

**按原样迁移同事的原型**：不重新设计，样式直接复用原型的 CSS（原样拷贝），页面结构、文案、mock 数据保持一致；之后再逐块把 mock 数据换成后端接口和链上数据。`v2-exchange/` 保留不动，用来对照。

## 本地运行

1. 后端先跑起来（见 `backend/README.md`），默认在 `http://localhost:3000`。
2. 复制 `.env.example` 为 `.env`，填 `VITE_PRIVY_APP_ID`（Privy 的 App ID，公开信息；密钥只在后端）。
3. 运行：

```bash
npm install
npm run dev      # 官网 http://localhost:5173/ ，交易所 /app/ ，发行方控制台 /app/issuer/
npm run build    # 类型检查 + 打包到 dist/
npm run lint
```

开发时 `/api` 自动转发到后端，不需要配跨域。`VITE_CHAIN` 选择链：`local`（本地 Hardhat 节点 :8545）或 `bscTestnet`。

## 部署（Vercel）

Vercel 项目的 Root Directory 设为 `frontend`，其余读 `vercel.json`：Vite、`npm run build`、输出 `dist`。`trailingSlash: true` 让 `/app` 自动跳到 `/app/`，否则页面里的相对链接（`../index.html`、`issuer/index.html`）会指错。环境变量在 Vercel 后台设置 `VITE_PRIVY_APP_ID`、`VITE_CHAIN`，并把正式域名加进 Privy 控制台的 Allowed origins。

## 结构

| 路径 | 内容 |
|---|---|
| `index.html` | 官网落地页（静态） |
| `app/index.html`、`app/issuer/index.html` | 交易所 App 和发行方控制台的入口 |
| `public/assets/` | 官网用的图片、视频、logo，从仓库根目录 `assets/` 复制 |
| `src/styles/prototype.css` | 交易所 App 的样式，从原型原样拷贝 |
| `src/demo/` | 交易所 App 的 mock 数据（`data.ts`）、页面状态（身份切换器、余额、认购）、小组件 |
| `src/layout/`、`src/pages/` | 交易所 App 的页面框架和各页面，文件开头写了对应原型里的哪个函数 |
| `src/components/Server3D.tsx` | 详情页的 3D 服务器插图（three.js r128，和原型同版本） |
| `src/issuer/` | 发行方控制台：样式（`issuer.css`，原样拷贝）、mock 数据、页面 |
| `src/session/`、`src/providers.tsx` | Privy 登录和后端会话（`POST /api/auth/session`），见下面「用户模块」 |

## 用户模块（已接 Privy，2026-10-14）

交易所 App 的登录和身份已经是真实的，页面上的贷款、余额、持仓仍是 mock。

| 位置 | 行为 |
|---|---|
| 右上角 Sign in、引导页 Sign in、Issue 页 Sign in to apply、认证弹窗 Sign in to start | 打开 Privy 登录框（邮箱、谷歌、钱包） |
| 当前身份 | 未登录 = Public；登录后由后端 `/api/me` 的 KYB 状态决定（unverified / pending / verified） |
| 右上角钱包地址 | 用户真实的钱包；邮箱和谷歌用户是 Privy 自动创建的内置钱包。点击即退出登录 |
| 后端拒绝会话（如邮箱已属于另一个账号） | 提示条常驻显示原因，右上角只剩 Sign out |
| 认证弹窗的 Start verification / View status | 进入 `#/verify` 企业认证流程，见下面「KYB」 |
| 左下角「view as」切换器 | 只在本地开发（`npm run dev`）显示，用来预览各身份；Live 跟随真实登录。正式构建不显示 |

发行方控制台还没有接登录（原型里它默认已登录为 Northwind Compute）。

## KYB（企业认证，2026-10-14）

原型里没有认证表单，按现有页面的样式补的，入口 `#/verify`（认证弹窗的 Start verification / View status）。流程参考 Stripe：一个人填完，只有申请人本人做人脸，董事和股东只做姓名筛查。

| 步骤 | 内容 |
|---|---|
| Company | 先上传注册证书，ID Analyzer 读出公司信息和董事并预填，用户确认后补机构类型和业务说明。注册处查不到也可以继续，提交后人工核对；证书不被接受时要换文件 |
| You | 先点 Verify my ID 打开嵌入的 DocuPass（人脸要用手机，电脑上会显示二维码），页面每 4 秒查一次结果。完成后姓名、生日、国籍从证件读出自动填上且不可改，只需补职位、持股比例、是否董事 |
| Owners | 证书上的董事自动列出，申请人本人在列时不重复填；可添加持股 25% 及以上的人；勾选名单完整声明。这一步不筛查：提交后后台对名单做姓名筛查，结果只给审核员 |
| Addresses | 勾选投资用的钱包（不允许 delegated 钱包），填公司控制的提现地址 |
| Review | 汇总 + 两项声明，提交后身份变为 In review |

两种模式（`src/kyb/actions.ts`）：

- **真实登录**：每步保存到后端（`/api/kyb`，见 `backend/README.md`），检查都是真实的 ID Analyzer 调用，会消耗额度。本地开发时状态页有 Start over，会删掉整个申请。
- **左下角 view as 预览**（仅开发）：检查是模拟的，进度存在浏览器 localStorage（`loka-kyb-demo-v4`）。上传任意文件即可，底部链接切换「注册处查到 / 查不到」。

代码：`src/kyb/store.ts`（表单状态、和后端数据的转换、模拟检查）、`src/kyb/actions.ts`（各步动作）、`src/pages/verify/`（各步骤和人脸验证弹窗）、`src/styles/kyb.css`（复用发行方申请表的样式，限定在 `.kybf` 下）。流程和状态见 `backend/docs/kyb.md`。

改样式的约定：先改原型或和设计确认，再把对应的 CSS 拷过来，不在这里单独改。

## 迁移进度（2026-10-14）

三个页面都已 1:1 还原，逐页截图和原型对比（1440 宽、全页）：

| 页面 | 对比结果 |
|---|---|
| 官网 | 像素完全相同 |
| 交易所 App（18 组：四种身份 × 各页面和页签） | 尺寸全部一致；8 组像素相同，其余差异 < 0.04%（文字抗锯齿） |
| 发行方控制台（8 组：贷款列表、放款任务、条款、还款、审核中、新申请、公司） | 尺寸全部一致；2 组像素相同，其余差异 < 0.01% |

交互也和原型一致：认购、撤回、入金、认证弹窗、身份切换、发行方的任务按钮、申请表的资格检查，以及三个页面之间的链接。

原型里隐藏的 Trade、Earn、Transparency、CCV 金库没有迁移。

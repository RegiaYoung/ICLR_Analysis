# ICLR 评审分析平台

<div align="center">

![在线演示](https://img.shields.io/badge/🌐_在线演示-http://10.123.4.17:3000/-blue?style=for-the-badge&logo=globe&logoColor=white)
![版本](https://img.shields.io/badge/版本-1.0.0-green?style=for-the-badge)
![许可证](https://img.shields.io/badge/许可证-MIT-yellow?style=for-the-badge)

[English](README.md) | **简体中文**

</div>

一个用于分析国际学习表征会议（ICLR）同行评议数据的综合平台。该工具提供对评审者行为、机构分析和同行评议过程质量指标的深入洞察。

## 🌐 在线演示

**访问地址**: [http://10.123.4.17:3000/](http://10.123.4.17:3000/)

## 📸 功能展示

<div align="center">

### 🔍 智能搜索功能

<table>
  <tr>
    <td width="50%" align="center">
      <img src="asserts/search_people.png" alt="人员搜索" style="width:100%; max-width:400px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);"/>
      <br/><br/>
      <h4>👥 人员搜索</h4>
      <p><em>按姓名、机构、国籍等条件搜索研究人员</em></p>
    </td>
    <td width="50%" align="center">
      <img src="asserts/search_paper.png" alt="论文搜索" style="width:100%; max-width:400px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);"/>
      <br/><br/>
      <h4>📄 论文搜索</h4>
      <p><em>搜索提交的论文和相关评审信息</em></p>
    </td>
  </tr>
</table>

### 📊 数据分析功能

<table>
  <tr>
    <td width="50%" align="center">
      <img src="asserts/reviewer.png" alt="评审者分析" style="width:100%; max-width:400px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);"/>
      <br/><br/>
      <h4>🔍 评审者分析</h4>
      <p><em>评审者严格性、一致性和偏见模式分析</em></p>
    </td>
    <td width="50%" align="center">
      <img src="asserts/institution.png" alt="机构分析" style="width:100%; max-width:400px; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.15);"/>
      <br/><br/>
      <h4>🏫 机构分析</h4>
      <p><em>机构影响力和地理分布分析</em></p>
    </td>
  </tr>
</table>

</div>

## 🚀 主要功能

- **评审者分析**: 分析评审者的严格性、一致性和偏见模式
- **机构洞察**: 探索地理分布和机构影响力
- **质量指标**: 全面的评审和投稿质量分析
- **交互式可视化**: 丰富的图表和图形数据探索
- **社区功能**: 研究社区讨论区
- **统计分析**: 评审数据的高级统计工具

## 📊 数据分析能力

- 评审者严格性和一致性分析
- 评审者和作者的地理分布
- 机构影响力指标
- 评审质量评估
- 利益冲突检测
- 学术多样性分析

## 🛠️ 技术栈

- **前端**: Next.js 14, React 18, Tailwind CSS
- **身份验证**: Better Auth 支持 Google/GitHub OAuth
- **数据库**: PostgreSQL 连接池
- **图表**: Chart.js 配合 React Chart.js 2
- **UI 组件**: Radix UI 原语
- **数据处理**: Python 分析脚本

## 📋 前置要求

- Node.js 18+ 和 npm/yarn
- PostgreSQL 数据库

## 🔧 安装步骤

1. **克隆代码库**
   ```bash
   git clone https://github.com/RegiaYoung/ICLR_Analysis.git
   cd ICLR_Analysis
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **设置环境变量**
   ```bash
   cp .env.example .env.local
   ```
   编辑 `.env.local` 文件配置：
   - 数据库连接字符串
   - Better Auth 密钥

4. **设置数据库**
   ```bash
   npm run init-db
   ```

5. **导入数据**（如果有 ICLR 评审数据）
   ```bash
   npm run migrate-json
   ```

6. **启动开发服务器**
   ```bash
   npm run dev
   ```

在浏览器中打开 [http://localhost:3000](http://localhost:3000) 查看应用。

## 📁 项目结构

```
├── app/                    # Next.js 应用路由页面
├── components/            # React 组件
│   ├── charts/           # 图表组件
│   └── ui/              # UI 原语
├── lib/                  # 工具库
├── scripts/              # 数据处理脚本
├── static-analysis-data/ # 预计算分析结果
├── asserts/              # 项目效果图
└── public/              # 静态资源
```

## 🔑 环境变量

| 变量名 | 描述 | 必需 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | 是 |
| `BETTER_AUTH_SECRET` | 身份验证密钥 | 是 |
| `NEXT_PUBLIC_APP_URL` | 应用 URL | 否 |

## 📊 数据模式

平台期望的评审数据格式：
- **评审**: submission_number, reviewer_id, rating, confidence, text
- **人员**: person_id, name, nationality, gender, roles, institutions
- **机构**: institution_name, country, type
- **投稿**: 投稿详情和元数据

## 🤝 贡献指南

1. Fork 代码库
2. 创建功能分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -m 'Add your feature'`
4. 推送到分支: `git push origin feature/your-feature`
5. 开启 Pull Request

## 📄 许可证

该项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- ICLR 会议组织者提供评审数据
- OpenReview 平台的同行评议透明化
- 研究社区的宝贵反馈

## 🔒 隐私与伦理

该平台专为学术研究目的设计。请确保：
- 敏感数据的适当匿名化
- 遵守数据保护法规
- 道德使用评审数据
- 尊重评审者和作者隐私

## 📞 支持

如有问题或需要支持，请：
- 在 GitHub 上开启 issue
- 查看现有文档
- 查阅故障排除指南

---

**注意**: 这是一个用于学术分析同行评议过程的研究工具。请负责任地使用，并遵守适用的数据保护和研究伦理准则。
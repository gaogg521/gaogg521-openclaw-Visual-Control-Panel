#快速启动办法（中文）
## 0. 指定 OpenClaw 目录（可选）
若 OpenClaw 不在默认的 `~/.openclaw`，可在项目根目录创建 `.env.local`，写入：
```env
OPENCLAW_HOME=C:/Users/你的用户名/.openclaw
```
（Windows 建议用正斜杠。可复制 `.env.example` 为 `.env.local` 后修改。）

## 1.通过prompt安装
```
在openclaw输入如下提示词，让openclaw帮启动：
请帮我安装并运行这个github项目，并把服务访问地址发给我：https://github.com/gaogg521/Openclaw-SKILLS-OneOne-
```

## 2.通过git安装
```
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-
npm install
npm run dev
```

## 3.通过skill安装
```
npx clawhub install openclaw-bot-dashboard
或者：npx skills add gaogg521/openclaw-bot-dashboard

安装后通过这些关键词触发启动服务：
- "打开 OpenClaw-bot-review"
- "打开 Openclaw dashboard"
- "打开 bot review"
- "打开机器人大盘"
- "打开 bot-review"
- "打开openclaw机器人大盘"
- "open openclaw dashboard"
- "open OpenClaw-bot-review"
- "open openclaw dashsboard"
- "launch bot review"
- "start dashboard"

```

---

# Quick Start (English)
## 0. Custom OpenClaw path (optional)
If OpenClaw is not in `~/.openclaw`, create `.env.local` in the project root with:
```env
OPENCLAW_HOME=C:/Users/YourUsername/.openclaw
```
(Use forward slashes on Windows. You can copy `.env.example` to `.env.local` and edit.)

## 1. Install via Prompt
```
In OpenClaw, send the prompt below and let OpenClaw set it up:
Please help me install and run this GitHub project, and send me the service URL: https://github.com/gaogg521/Openclaw-SKILLS-OneOne-
```

## 2. Install via Git
```
git clone https://github.com/gaogg521/Openclaw-SKILLS-OneOne-.git
cd Openclaw-SKILLS-OneOne-
npm install
npm run dev
```

## 3. Install via Skill
```
npx clawhub install openclaw-bot-dashboard
or: npx skills add gaogg521/openclaw-bot-dashboard

After installation, use these trigger phrases to start the service:
- "打开 OpenClaw-bot-review"
- "打开 Openclaw dashboard"
- "打开 bot review"
- "打开机器人大盘"
- "打开 bot-review"
- "打开openclaw机器人大盘"
- "open openclaw dashboard"
- "open OpenClaw-bot-review"
- "open openclaw dashsboard"
- "launch bot review"
- "start dashboard"
```

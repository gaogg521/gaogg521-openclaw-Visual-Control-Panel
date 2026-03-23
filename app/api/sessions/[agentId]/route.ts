import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { OPENCLAW_HOME } from "@/lib/openclaw-paths";

export async function GET(_req: Request, { params }: { params: Promise<{ agentId: string }> }) {
  try {
    const { agentId } = await params;
    const sessionsPath = path.join(OPENCLAW_HOME, `agents/${agentId}/sessions/sessions.json`);
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const sessions = JSON.parse(raw);

    const list = Object.entries(sessions).map(([key, val]: [string, any]) => {
      // 解析 session 类型
      let type = "unknown";
      let target = "";
      if (key.endsWith(":main")) {
        type = "main";
      } else if (key.includes(":feishu:direct:")) {
        type = "feishu-dm";
        target = key.split(":feishu:direct:")[1];
      } else if (key.includes(":feishu:group:")) {
        type = "feishu-group";
        target = key.split(":feishu:group:")[1];
      } else if (key.includes(":discord:direct:")) {
        type = "discord-dm";
        target = key.split(":discord:direct:")[1];
      } else if (key.includes(":discord:channel:")) {
        type = "discord-channel";
        target = key.split(":discord:channel:")[1];
      } else if (key.includes(":telegram:direct:")) {
        type = "telegram-dm";
        target = key.split(":telegram:direct:")[1];
      } else if (key.includes(":telegram:group:")) {
        type = "telegram-group";
        target = key.split(":telegram:group:")[1];
      } else if (key.includes(":whatsapp:direct:")) {
        type = "whatsapp-dm";
        target = key.split(":whatsapp:direct:")[1];
      } else if (key.includes(":whatsapp:group:")) {
        type = "whatsapp-group";
        target = key.split(":whatsapp:group:")[1];
      } else if (key.includes(":cron:")) {
        type = "cron";
        target = key.split(":cron:")[1];
      }

      return {
        key,
        type,
        target,
        sessionId: val.sessionId || null,
        updatedAt: val.updatedAt || 0,
        totalTokens: val.totalTokens || 0,
        contextTokens: val.contextTokens || 0,
        systemSent: val.systemSent || false,
      };
    });

    // 按最近活跃排序
    list.sort((a, b) => b.updatedAt - a.updatedAt);

    return NextResponse.json({ agentId, sessions: list });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

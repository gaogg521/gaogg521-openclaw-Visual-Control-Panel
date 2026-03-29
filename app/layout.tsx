import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Sidebar } from "./sidebar";
import { AlertMonitor } from "./alert-monitor";
import { GlobalBugsOverlay } from "./global-bugs-overlay";

export const metadata: Metadata = {
  title: "ONE CLAW控制台",
  description: "ONE CLAW 专家战队 / Agent 与会话一览 · ONE CLAW控制台",
  icons: { icon: "/brand-mark.png", apple: "/brand-mark.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <AlertMonitor />
          <GlobalBugsOverlay />
          <div className="min-h-screen md:flex">
            <Sidebar />
            <main className="flex-1 overflow-auto pt-14 md:pt-0">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}

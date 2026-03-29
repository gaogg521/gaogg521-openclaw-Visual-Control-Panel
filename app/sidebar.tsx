"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { ThemeSwitcher } from "@/lib/theme";

/** 透明底品牌图，由 `npm run brand:mark` 从源 PNG 生成 */
const BRAND_LOGO_SRC = "/brand-mark.png";
const BRAND_MARK_W = 57;
const BRAND_MARK_H = 56;

type NavIconName =
  | "agents"
  | "pixelOffice"
  | "models"
  | "sessions"
  | "stats"
  | "alerts"
  | "skills"
  | "setup"
  | "memory";
type PixelTone = "base" | "shade" | "light";
type PixelRect = { x: number; y: number; w?: number; h?: number; tone?: PixelTone; opacity?: number };
type PixelPalette = { base: string; shade: string; light: string };

function PixelSvg({ pixels, className, palette }: { pixels: PixelRect[]; className?: string; palette: PixelPalette }) {
  const fillForTone = (tone: PixelTone = "base") => {
    if (tone === "shade") return palette.shade;
    if (tone === "light") return palette.light;
    return palette.base;
  };

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      style={{
        imageRendering: "pixelated",
        shapeRendering: "crispEdges",
        width: "1rem",
        height: "1rem",
        minWidth: "1rem",
        minHeight: "1rem",
        display: "block",
      }}
    >
      {pixels.map((pixel, index) => (
        <rect
          key={index}
          x={pixel.x}
          y={pixel.y}
          width={pixel.w ?? 1}
          height={pixel.h ?? 1}
          fill={fillForTone(pixel.tone)}
          opacity={pixel.opacity ?? 1}
        />
      ))}
    </svg>
  );
}

function navPalette(active: boolean): PixelPalette {
  // 避免使用 color-mix，提升旧浏览器兼容性
  return active
    ? { base: "var(--accent)", shade: "var(--accent)", light: "var(--accent)" }
    : { base: "var(--text)", shade: "var(--text)", light: "var(--text)" };
}

function NavPixelIcon({ name, active }: { name: NavIconName; active: boolean }) {
  const baseClass = "h-4 w-4";
  const palette = navPalette(active);

  switch (name) {
    case "agents":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 5, y: 1, w: 6, h: 1, tone: "light" },
            { x: 4, y: 2, w: 8, h: 1, tone: "base" },
            { x: 3, y: 3, w: 10, h: 2, tone: "base" },
            { x: 4, y: 5, w: 8, h: 1, tone: "shade" },
            { x: 2, y: 7, w: 12, h: 1, tone: "base" },
            { x: 1, y: 8, w: 3, h: 5, tone: "shade" },
            { x: 6, y: 8, w: 4, h: 2, tone: "light", opacity: 0.95 },
            { x: 12, y: 8, w: 3, h: 5, tone: "shade" },
            { x: 5, y: 10, w: 6, h: 4, tone: "base" },
            { x: 6, y: 6, w: 1, h: 1, tone: "light", opacity: 0.65 },
            { x: 9, y: 6, w: 1, h: 1, tone: "light", opacity: 0.65 },
          ]}
        />
      );
    case "pixelOffice":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 1, y: 4, w: 14, h: 1, tone: "shade" },
            { x: 1, y: 5, w: 2, h: 8, tone: "base" },
            { x: 13, y: 5, w: 2, h: 8, tone: "base" },
            { x: 5, y: 1, w: 6, h: 2, tone: "light" },
            { x: 4, y: 3, w: 8, h: 1, tone: "base" },
            { x: 4, y: 7, w: 3, h: 3, tone: "shade" },
            { x: 9, y: 7, w: 3, h: 3, tone: "shade" },
            { x: 6, y: 10, w: 4, h: 3, tone: "light", opacity: 0.9 },
          ]}
        />
      );
    case "models":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 5, y: 1, w: 6, h: 1, tone: "light" },
            { x: 3, y: 3, w: 10, h: 1, tone: "base" },
            { x: 2, y: 5, w: 12, h: 1, tone: "shade" },
            { x: 3, y: 7, w: 10, h: 1, tone: "base" },
            { x: 5, y: 9, w: 6, h: 1, tone: "light" },
            { x: 4, y: 2, w: 1, h: 1, tone: "light", opacity: 0.8 },
            { x: 11, y: 2, w: 1, h: 1, tone: "light", opacity: 0.8 },
            { x: 1, y: 4, w: 1, h: 2, tone: "shade", opacity: 0.9 },
            { x: 14, y: 4, w: 1, h: 2, tone: "shade", opacity: 0.9 },
            { x: 4, y: 11, w: 1, h: 2, tone: "shade", opacity: 0.9 },
            { x: 11, y: 11, w: 1, h: 2, tone: "shade", opacity: 0.9 },
            { x: 6, y: 13, w: 4, h: 1, tone: "base" },
          ]}
        />
      );
    case "sessions":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 2, y: 3, w: 10, h: 7, tone: "base" },
            { x: 4, y: 10, w: 4, h: 2, tone: "shade" },
            { x: 10, y: 10, w: 2, h: 2, tone: "shade" },
            { x: 4, y: 5, w: 6, h: 1, tone: "light", opacity: 0.6 },
            { x: 4, y: 7, w: 4, h: 1, tone: "light", opacity: 0.6 },
            { x: 11, y: 6, w: 3, h: 5, tone: "shade", opacity: 0.9 },
            { x: 12, y: 5, w: 2, h: 1, tone: "light", opacity: 0.85 },
          ]}
        />
      );
    case "stats":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 2, y: 12, w: 12, h: 1, tone: "shade", opacity: 0.7 },
            { x: 3, y: 9, w: 2, h: 3, tone: "base" },
            { x: 7, y: 6, w: 2, h: 6, tone: "base" },
            { x: 11, y: 3, w: 2, h: 9, tone: "light" },
            { x: 2, y: 4, w: 2, h: 2, tone: "shade", opacity: 0.65 },
            { x: 5, y: 2, w: 2, h: 2, tone: "light", opacity: 0.65 },
          ]}
        />
      );
    case "alerts":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 7, y: 1, w: 2, h: 1, tone: "light" },
            { x: 5, y: 2, w: 6, h: 1, tone: "base" },
            { x: 4, y: 3, w: 8, h: 1, tone: "base" },
            { x: 4, y: 4, w: 8, h: 5, tone: "shade" },
            { x: 3, y: 9, w: 10, h: 2, tone: "base" },
            { x: 6, y: 12, w: 4, h: 1, tone: "light" },
            { x: 5, y: 13, w: 6, h: 1, tone: "shade", opacity: 0.8 },
          ]}
        />
      );
    case "skills":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 6, y: 1, w: 4, h: 2, tone: "light" },
            { x: 4, y: 3, w: 8, h: 2, tone: "base" },
            { x: 2, y: 5, w: 12, h: 6, tone: "shade" },
            { x: 4, y: 11, w: 8, h: 2, tone: "base" },
            { x: 6, y: 13, w: 4, h: 2, tone: "light" },
            { x: 7, y: 6, w: 2, h: 4, tone: "base", opacity: 0.5 },
            { x: 5, y: 7, w: 6, h: 2, tone: "light", opacity: 0.45 },
          ]}
        />
      );
    case "setup":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 7, y: 1, w: 2, h: 2, tone: "light" },
            { x: 6, y: 3, w: 4, h: 2, tone: "base" },
            { x: 5, y: 5, w: 6, h: 4, tone: "shade" },
            { x: 4, y: 9, w: 3, h: 2, tone: "base" },
            { x: 9, y: 9, w: 3, h: 2, tone: "base" },
            { x: 7, y: 11, w: 2, h: 3, tone: "light", opacity: 0.9 },
          ]}
        />
      );
    case "memory":
      return (
        <PixelSvg
          className={baseClass}
          palette={palette}
          pixels={[
            { x: 4, y: 2, w: 8, h: 1, tone: "light" },
            { x: 3, y: 4, w: 10, h: 1, tone: "base" },
            { x: 3, y: 6, w: 10, h: 1, tone: "shade" },
            { x: 3, y: 8, w: 10, h: 1, tone: "base" },
            { x: 3, y: 10, w: 10, h: 1, tone: "shade" },
            { x: 5, y: 12, w: 6, h: 1, tone: "light" },
            { x: 2, y: 3, w: 1, h: 8, tone: "shade", opacity: 0.85 },
          ]}
        />
      );
  }
}

function NavItemIcon({ name, active }: { name: NavIconName; active: boolean }) {
  return (
    <span
      className={`inline-flex h-8 w-8 items-center justify-center border transition-colors ${
        active
          ? "border-[var(--accent)]/45 bg-[var(--accent)]/14"
          : "border-[var(--border)] bg-[var(--bg)]/88"
      }`}
      style={{
        borderRadius: 0,
        width: "2rem",
        height: "2rem",
        minWidth: "2rem",
        minHeight: "2rem",
        display: "inline-flex",
        flexShrink: 0,
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.04)"
          : "inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 0 rgba(0,0,0,0.1)",
      }}
    >
      <NavPixelIcon name={name} active={active} />
    </span>
  );
}

const NAV_ITEMS: { group: string; items: { href: string; icon: NavIconName; labelKey: string }[] }[] = [
  {
    group: "nav.overview",
    items: [
      { href: "/oneone-dashboard", icon: "stats", labelKey: "nav.oneoneDashboard" },
      { href: "/expert-squad", icon: "agents", labelKey: "nav.agents" },
      { href: "/pixel-office", icon: "pixelOffice", labelKey: "nav.pixelOffice" },
      { href: "/models", icon: "models", labelKey: "nav.models" },
    ],
  },
  {
    group: "nav.oneoneAdmin",
    items: [
      { href: "/channels", icon: "sessions", labelKey: "nav.channels" },
      { href: "/sessions", icon: "sessions", labelKey: "nav.sessions" },
      { href: "/memory", icon: "memory", labelKey: "nav.memory" },
      { href: "/expert-files", icon: "skills", labelKey: "nav.expertFiles" },
    ],
  },
  {
    group: "nav.monitor",
    items: [
      { href: "/stats", icon: "stats", labelKey: "nav.stats" },
      { href: "/alerts", icon: "alerts", labelKey: "nav.alerts" },
    ],
  },
  {
    group: "nav.config",
    items: [
      { href: "/setup", icon: "setup", labelKey: "nav.setupWizard" },
      { href: "/skills", icon: "skills", labelKey: "nav.skills" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAgentCount, setMobileAgentCount] = useState<number | null>(null);
  const [mobileOpenclawVersion, setMobileOpenclawVersion] = useState<string | null>(null);
  const [logoCarry, setLogoCarry] = useState<{ active: boolean; dx: number; dy: number; angle: number; hidden: boolean }>({
    active: false,
    dx: 0,
    dy: 0,
    angle: 0,
    hidden: false,
  });
  const [manualLogoOffset, setManualLogoOffset] = useState<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const [manualLogoAngle, setManualLogoAngle] = useState(0);
  const [isLogoDragging, setIsLogoDragging] = useState(false);
  const suppressLogoClickRef = useRef(false);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; originDx: number; originDy: number; moved: boolean; lastX: number; lastY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    originDx: 0,
    originDy: 0,
    moved: false,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    const onStart = () => setLogoCarry((s) => ({ ...s, active: true, hidden: false }));
    const onStop = () => setLogoCarry({ active: false, dx: 0, dy: 0, angle: 0, hidden: false });
    const onProgress = (e: Event) => {
      if (dragRef.current.active) return;
      const ce = e as CustomEvent<{ active: boolean; dx: number; dy: number; angle: number; hidden: boolean }>;
      const d = ce.detail;
      if (!d) return;
      setLogoCarry({ active: !!d.active, dx: d.dx || 0, dy: d.dy || 0, angle: d.angle || 0, hidden: !!d.hidden });
    };
    window.addEventListener("openclaw-logo-drag-start", onStart as EventListener);
    window.addEventListener("openclaw-logo-drag-stop", onStop as EventListener);
    window.addEventListener("openclaw-logo-carry-progress", onProgress as EventListener);
    return () => {
      window.removeEventListener("openclaw-logo-drag-start", onStart as EventListener);
      window.removeEventListener("openclaw-logo-drag-stop", onStop as EventListener);
      window.removeEventListener("openclaw-logo-carry-progress", onProgress as EventListener);
    };
  }, []);

  useEffect(() => {
    const stopDrag = () => {
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      if (dragRef.current.moved) suppressLogoClickRef.current = true;
      setIsLogoDragging(false);
      document.body.style.userSelect = "";
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragRef.current.active) return;
      const nextDx = dragRef.current.originDx + (e.clientX - dragRef.current.startX);
      const nextDy = dragRef.current.originDy + (e.clientY - dragRef.current.startY);
      if (Math.abs(nextDx - dragRef.current.originDx) > 3 || Math.abs(nextDy - dragRef.current.originDy) > 3) {
        dragRef.current.moved = true;
      }
      const moveX = e.clientX - dragRef.current.lastX;
      const moveY = e.clientY - dragRef.current.lastY;
      if (Math.abs(moveX) + Math.abs(moveY) > 0.2) {
        const targetAngle = Math.max(-0.95, Math.min(0.95, Math.atan2(moveY, moveX) * 0.65));
        setManualLogoAngle((prev) => prev * 0.65 + targetAngle * 0.35);
      }
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      setManualLogoOffset({ dx: nextDx, dy: nextDy });
    };
    const onMouseUp = () => stopDrag();
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
    };
  }, []);

  const handleLogoMouseDown = (e: React.MouseEvent<HTMLSpanElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originDx: manualLogoOffset.dx,
      originDy: manualLogoOffset.dy,
      moved: false,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    setIsLogoDragging(true);
    document.body.style.userSelect = "none";
  };

  const handleLogoClickCapture = (e: React.MouseEvent<HTMLElement>) => {
    if (!suppressLogoClickRef.current) return;
    suppressLogoClickRef.current = false;
    e.preventDefault();
    e.stopPropagation();
  };

  const handleLogoNativeDragStart = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
  };

  const logoTransform = `translate(${manualLogoOffset.dx + logoCarry.dx}px, ${manualLogoOffset.dy + logoCarry.dy}px) rotate(${logoCarry.angle + manualLogoAngle}rad)`;
  const mobileLogoTransform = `translate(${logoCarry.dx}px, ${logoCarry.dy}px) rotate(${logoCarry.angle}rad)`;
  const logoCursor = isLogoDragging ? "grabbing" : "grab";
  const mobileCurrent = NAV_ITEMS.flatMap((g) => g.items).find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    let aborted = false;
    const fetchAgentCount = async () => {
      try {
        const res = await fetch("/api/config", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (aborted) return;
        const count = Array.isArray(data?.agents) ? data.agents.length : 0;
        setMobileAgentCount(count);
      } catch {}
    };
    if (pathname === "/expert-squad") {
      void fetchAgentCount();
      const timer = setInterval(fetchAgentCount, 30000);
      return () => {
        aborted = true;
        clearInterval(timer);
      };
    }
    return () => {
      aborted = true;
    };
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    const fetchOpenclawVersion = async () => {
      try {
        const res = await fetch("/api/gateway-health", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const version = typeof data?.openclawVersion === "string" ? data.openclawVersion.trim() : "";
        setMobileOpenclawVersion(version || null);
      } catch {}
    };
    void fetchOpenclawVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="md:hidden">
        <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur">
          <div className="h-full px-3 flex items-center justify-between gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="w-9 h-9 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)] text-base"
              aria-label="Open menu"
            >
              ☰
            </button>
            <Link
              href="/oneone-dashboard"
              className="flex items-center gap-2 min-w-0"
              onClickCapture={handleLogoClickCapture}
              onDragStart={handleLogoNativeDragStart}
              draggable={false}
            >
              <span
                className="relative inline-block leading-none transition-opacity duration-300"
                data-openclaw-logo-anchor="true"
                onDragStart={handleLogoNativeDragStart}
                draggable={false}
                style={{
                  transform: mobileLogoTransform,
                  transformOrigin: "50% 50%",
                  opacity: logoCarry.hidden ? 0 : 1,
                }}
              >
                <Image
                  src={BRAND_LOGO_SRC}
                  alt=""
                  width={BRAND_MARK_W}
                  height={BRAND_MARK_H}
                  className="h-9 w-auto max-w-[2.75rem] object-contain select-none pointer-events-none"
                  draggable={false}
                  style={{ width: "auto", height: "2.25rem" }}
                />
              </span>
              <div className="min-w-0">
                <div className="text-xs font-bold tracking-wide truncate">
                  {pathname.startsWith("/pixel-office")
                    ? t("pixelOffice.title")
                    : mobileOpenclawVersion
                      ? `ONE CLAW ${String(mobileOpenclawVersion).replace(/\bOpenClaw\s*/gi, "").trim()}`
                      : t("site.title")}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] truncate">
                  {pathname.startsWith("/pixel-office")
                    ? ""
                    : pathname === "/expert-squad" && mobileAgentCount !== null
                    ? `${mobileAgentCount} ${t("home.agentCount")}`
                    : mobileCurrent ? t(mobileCurrent.labelKey) : "BOT"}
                </div>
              </div>
            </Link>
            <div className="flex items-center gap-1 flex-wrap justify-end max-w-[min(100%,280px)]">
              <LanguageSwitcher />
              <ThemeSwitcher />
            </div>
          </div>
        </header>

        {mobileMenuOpen && (
          <div className="fixed inset-0 z-[55]">
            <button
              className="absolute inset-0 bg-black/45"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu overlay"
            />
            <aside className="absolute top-0 left-0 bottom-0 w-[276px] max-w-[86vw] border-r border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col">
              <div className="h-14 px-3 border-b border-[var(--border)] flex items-center justify-between">
                <div className="font-semibold text-sm">{t("site.title")}</div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg)] text-[var(--text)]"
                  aria-label="Close menu"
                >
                  ×
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3">
                <div className="space-y-4">
                  {NAV_ITEMS.map((group) => (
                    <div key={group.group}>
                      <div className="px-1 mb-1 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                        {t(group.group)}
                      </div>
                      <div className="space-y-1">
                        {group.items.map((item) => {
                          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                                active
                                  ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
                              }`}
                            >
                              <NavItemIcon name={item.icon} active={active} />
                              {t(item.labelKey)}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </nav>
            </aside>
          </div>
        )}
      </div>

      <aside
        className="sidebar hidden md:flex"
        style={{ width: collapsed ? 64 : 224 }}
      >
        {/* Header: Logo + Toggle */}
        <div className="border-b border-[var(--border)]" style={{ padding: collapsed ? "16px 0" : "16px 20px" }}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2">
              <Link href="/oneone-dashboard" onClickCapture={handleLogoClickCapture} onDragStart={handleLogoNativeDragStart} draggable={false}>
                <span
                  className="relative inline-block transition-opacity duration-300"
                  onMouseDown={handleLogoMouseDown}
                  onDragStart={handleLogoNativeDragStart}
                  draggable={false}
                  style={{
                    lineHeight: 1,
                    transform: logoTransform,
                    opacity: logoCarry.hidden ? 0 : 1,
                    cursor: logoCursor,
                  }}
                >
                  <Image
                    src={BRAND_LOGO_SRC}
                    alt=""
                    width={BRAND_MARK_W}
                    height={BRAND_MARK_H}
                    className="h-10 w-auto max-w-[2.75rem] object-contain select-none pointer-events-none"
                    draggable={false}
                    style={{ width: "auto", height: "2.5rem" }}
                  />
                </span>
              </Link>
              <button
                onClick={() => setCollapsed(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-lg"
                title={t("nav.expandSidebar")}
              >
                »
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <Link
                  href="/oneone-dashboard"
                  className="flex items-center gap-2"
                  onClickCapture={handleLogoClickCapture}
                  onDragStart={handleLogoNativeDragStart}
                  draggable={false}
                >
                  <span
                    className="relative inline-block transition-opacity duration-300"
                    onMouseDown={handleLogoMouseDown}
                    onDragStart={handleLogoNativeDragStart}
                    draggable={false}
                    style={{
                      lineHeight: 1,
                      transform: logoTransform,
                      opacity: logoCarry.hidden ? 0 : 1,
                      cursor: logoCursor,
                    }}
                  >
                    <Image
                      src={BRAND_LOGO_SRC}
                      alt=""
                      width={BRAND_MARK_W}
                      height={BRAND_MARK_H}
                      className="h-14 w-auto max-w-[4.5rem] object-contain select-none pointer-events-none"
                      draggable={false}
                      style={{ width: "auto", height: "3.5rem" }}
                    />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-[var(--text)] tracking-wide leading-tight">{t("site.title")}</div>
                    <div className="text-[10px] text-[var(--text-muted)] tracking-wider">BOT</div>
                  </div>
                </Link>
                <button
                  onClick={() => setCollapsed(true)}
                  className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-lg"
                  title={t("nav.collapseSidebar")}
                >
                  «
                </button>
              </div>
              <div className="flex flex-col gap-2 mt-2 pl-2 pr-1 [&_select]:w-full [&_select]:max-w-none">
                <LanguageSwitcher />
                <ThemeSwitcher />
              </div>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav className="sidebar-nav" style={{ padding: collapsed ? "16px 8px" : "16px 12px" }}>
          <div className="space-y-5">
            {NAV_ITEMS.map((group) => (
              <div key={group.group}>
                {!collapsed && (
                  <div className="px-2 mb-2 text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center justify-between">
                    {t(group.group)}
                    <span className="text-[var(--text-muted)] opacity-40">—</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? t(item.labelKey) : undefined}
                        className={`flex items-center rounded-lg text-sm transition-colors ${
                          active
                            ? "bg-[var(--accent)]/15 text-[var(--accent)] font-medium"
                            : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg)]"
                        }`}
                        style={{
                          padding: collapsed ? "8px 0" : "8px 12px",
                          justifyContent: collapsed ? "center" : "flex-start",
                          gap: collapsed ? 0 : 10,
                        }}
                      >
                        <NavItemIcon name={item.icon} active={active} />
                        {!collapsed && t(item.labelKey)}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {collapsed && (
              <button
                type="button"
                onClick={() => setCollapsed(false)}
                title={t("nav.expandSidebar")}
                className="w-full flex items-center justify-center rounded-lg px-2 py-2 text-base border border-[var(--border)] bg-[var(--card)]/65 text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
              >
                »
              </button>
            )}
          </div>
        </nav>
      </aside>

      {/* Spacer */}
      <div className="hidden md:block" style={{ width: collapsed ? 64 : 224, flexShrink: 0, transition: "width 0.2s" }} />
    </>
  );
}

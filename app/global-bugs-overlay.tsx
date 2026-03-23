"use client";

import { useEffect, useRef } from "react";
import { BugSystem } from "@/lib/pixel-office/bugs/bugSystem";
import { renderBugs } from "@/lib/pixel-office/bugs/renderer";

const BUGS_ENABLED_KEY = "pixel-office-bugs-enabled";
const BUGS_COUNT_KEY = "pixel-office-bugs-count";
const BUGS_MAX = 400;
const BUGS_ZOOM = 2.5;

function readConfig(): { enabled: boolean; count: number } {
  const enabled = localStorage.getItem(BUGS_ENABLED_KEY) === "true";
  const raw = Number(localStorage.getItem(BUGS_COUNT_KEY) || "5");
  const count = Math.max(0, Math.min(BUGS_MAX, Number.isFinite(raw) ? raw : 5));
  return { enabled, count };
}

export function GlobalBugsOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemRef = useRef<BugSystem | null>(null);
  const enabledRef = useRef(false);
  const countRef = useRef(5);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const initial = readConfig();
    enabledRef.current = initial.enabled;
    countRef.current = initial.count;

    const system = new BugSystem(window.innerWidth / BUGS_ZOOM, window.innerHeight / BUGS_ZOOM, initial.count);
    system.setEnabled(initial.enabled);
    system.setTargetCount(initial.count, window.innerWidth / BUGS_ZOOM, window.innerHeight / BUGS_ZOOM);
    systemRef.current = system;

    const applyConfig = () => {
      if (!systemRef.current) return;
      const cfg = readConfig();
      enabledRef.current = cfg.enabled;
      countRef.current = cfg.count;
      systemRef.current.setEnabled(cfg.enabled);
      systemRef.current.setTargetCount(cfg.count, window.innerWidth / BUGS_ZOOM, window.innerHeight / BUGS_ZOOM);
    };

    const onStorage = () => applyConfig();
    const onConfigChanged = () => applyConfig();
    const getVisibleLogoAnchorCenter = (): { x: number; y: number } | null => {
      const anchors = Array.from(document.querySelectorAll<HTMLElement>("[data-openclaw-logo-anchor='true']"));
      for (const anchor of anchors) {
        const rect = anchor.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        return {
          x: (rect.left + rect.width / 2) / BUGS_ZOOM,
          y: (rect.top + rect.height / 2) / BUGS_ZOOM,
        };
      }
      return null;
    };
    const onLogoDragStart = () => {
      if (!systemRef.current) return;
      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      let startX: number;
      let startY: number;
      if (isMobile) {
        const anchorCenter = getVisibleLogoAnchorCenter();
        if (anchorCenter) {
          startX = anchorCenter.x;
          startY = anchorCenter.y;
        } else {
          startX = (window.innerWidth / 2) / BUGS_ZOOM;
          startY = 28 / BUGS_ZOOM;
        }
      } else {
        // Keep desktop behavior unchanged.
        startX = 58 / BUGS_ZOOM;
        startY = 42 / BUGS_ZOOM;
      }

      const targetX = (window.innerWidth + 180) / BUGS_ZOOM;
      const targetY = (window.innerHeight + 160) / BUGS_ZOOM;
      systemRef.current.startLogoCarry(startX, startY, targetX, targetY);
    };
    const onLogoDragStop = () => {
      if (!systemRef.current) return;
      systemRef.current.stopLogoCarry();
      window.dispatchEvent(new CustomEvent("openclaw-logo-carry-progress", {
        detail: { dx: 0, dy: 0, angle: 0, hidden: false, active: false },
      }));
    };
    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY, active: true };
    };
    const onLeave = () => {
      mouseRef.current.active = false;
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("openclaw-bugs-config-change", onConfigChanged as EventListener);
    window.addEventListener("openclaw-logo-drag-start", onLogoDragStart as EventListener);
    window.addEventListener("openclaw-logo-drag-stop", onLogoDragStop as EventListener);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseout", onLeave);

    let last = 0;
    const tick = (ts: number) => {
      const dt = last === 0 ? 0 : Math.min((ts - last) / 1000, 0.1);
      last = ts;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }

      const ctx = canvas.getContext("2d");
      if (ctx && systemRef.current) {
        systemRef.current.setCursor(mouseRef.current.x / BUGS_ZOOM, mouseRef.current.y / BUGS_ZOOM, mouseRef.current.active);
        systemRef.current.update(dt, w / BUGS_ZOOM, h / BUGS_ZOOM);
        const carry = systemRef.current.getLogoCarryVisual();
        window.dispatchEvent(new CustomEvent("openclaw-logo-carry-progress", {
          detail: { dx: carry.dx * BUGS_ZOOM, dy: carry.dy * BUGS_ZOOM, angle: carry.angle, hidden: carry.hidden, active: carry.active },
        }));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        renderBugs(ctx, systemRef.current.getBugs(), 0, 0, BUGS_ZOOM);
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("openclaw-bugs-config-change", onConfigChanged as EventListener);
      window.removeEventListener("openclaw-logo-drag-start", onLogoDragStart as EventListener);
      window.removeEventListener("openclaw-logo-drag-stop", onLogoDragStop as EventListener);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseout", onLeave);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[60]" />;
}

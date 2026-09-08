"use client";
import { useEffect, useSyncExternalStore } from "react";

const query =
  "(max-width: 767px), (hover: none) and (pointer: coarse) and (max-height: 500px)";
function subscribe(change: () => void) {
  const media = window.matchMedia(query);
  media.addEventListener("change", change);
  return () => media.removeEventListener("change", change);
}
export function useMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

export function dismissKeyboard() {
  const focused = document.activeElement;
  if (
    focused instanceof HTMLElement &&
    focused.matches("input, textarea, [contenteditable]")
  ) {
    focused.blur();
  }
}

// iOS can both resize and pan the visual viewport when the keyboard opens.
// Keep the app in that visible rectangle, without disabling accessible zoom.
export function useMobileViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;
    let frame = 0;
    let baselineHeight = window.innerHeight;
    let baselineWidth = window.innerWidth;
    function update() {
      frame = 0;
      if (viewport && Math.abs(viewport.scale - 1) > 0.05) return;
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;
      if (window.innerWidth !== baselineWidth) {
        baselineWidth = window.innerWidth;
        baselineHeight = window.innerHeight;
      }
      const editing = document.activeElement?.matches(
        "input, textarea, [contenteditable]",
      );
      const previousKeyboard = root.dataset.keyboard === "open";
      // Chromium can resize the layout viewport as well. Retain its pre-keyboard
      // height until the keyboard closes, but reset it on orientation changes.
      const layoutHeight = Math.max(
        window.innerHeight,
        root.clientHeight,
        editing || previousKeyboard ? baselineHeight : 0,
      );
      const keyboard = layoutHeight - height > 120;
      if (!keyboard) baselineHeight = window.innerHeight;
      root.style.setProperty("--app-height", `${height}px`);
      root.style.setProperty("--viewport-top", `${top}px`);
      root.dataset.keyboard = keyboard ? "open" : "closed";
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    return () => {
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      root.style.removeProperty("--app-height");
      root.style.removeProperty("--viewport-top");
      delete root.dataset.keyboard;
    };
  }, []);
}

"use client";

// Pause a WebGL canvas while it is off screen or while the page is scrolling: the two scenes
// otherwise redraw 60 times per second and make scrolling stutter. Animations are driven by
// clocks (performance.now, simulation steps), so they resume at the right place.

import { useEffect, useState, type RefObject } from "react";

const SCROLL_IDLE_MS = 150;

export function useRenderGate(ref: RefObject<HTMLElement | null>): "always" | "never" {
  const [visible, setVisible] = useState(true);
  const [scrolling, setScrolling] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    let timer = 0;
    const onScroll = () => {
      setScrolling(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setScrolling(false), SCROLL_IDLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(timer);
    };
  }, [ref]);
  return visible && !scrolling ? "always" : "never";
}

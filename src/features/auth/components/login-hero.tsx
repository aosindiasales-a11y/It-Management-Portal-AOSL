"use client";

import * as React from "react";
import { gsap } from "gsap";

import { createHeroScene } from "@/features/auth/lib/login-hero-scene";

const STATS = [
  { label: "Since 2017", value: "9 Years of Excellence" },
  { label: "Certified", value: "AS9120 Aerospace Standard" },
  { label: "Reach", value: "Global Aviation Supply Network" },
];

export function LoginHero() {
  const canvasHostRef = React.useRef<HTMLDivElement>(null);
  const cardsRef = React.useRef<HTMLDivElement>(null);
  const headingRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = createHeroScene(host, reducedMotion);
    return () => scene.dispose();
  }, []);

  React.useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reducedMotion) {
        gsap.set([headingRef.current, cardsRef.current?.children ?? []], { opacity: 1, y: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(headingRef.current, { opacity: 0, y: 24, duration: 0.7 }).from(
        cardsRef.current?.children ?? [],
        { opacity: 0, y: 30, stagger: 0.15, duration: 0.6 },
        "-=0.3"
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="bg-hero-mesh relative flex h-full flex-col justify-between overflow-hidden px-14 py-16 text-white">
      <div ref={canvasHostRef} className="pointer-events-none absolute inset-0" aria-hidden />

      <div ref={headingRef} className="relative z-10 max-w-lg">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-wide backdrop-blur-sm">
          Aviation Overseas Supply Logistics
        </span>
        <h2 className="mt-6 text-4xl font-bold leading-tight tracking-tight">
          Powering Aviation Logistics with Trust &amp; Precision
        </h2>
        <p className="mt-4 max-w-md text-sm text-white/70">
          A reliable enterprise platform trusted by airlines, MROs, and OEMs for certified aerospace supply and IT
          operations.
        </p>
      </div>

      <div ref={cardsRef} className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {STATS.map((stat, index) => (
          <div
            key={stat.label}
            className="animate-float rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"
            style={{ animationDelay: `${index * 0.6}s` }}
          >
            <p className="text-[11px] uppercase tracking-wide text-white/50">{stat.label}</p>
            <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

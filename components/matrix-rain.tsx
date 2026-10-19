"use client";

import { useEffect, useRef } from "react";

const GLYPHS = "01アイウカキクANITA♥";

export function MatrixRain({ active }: { active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !active) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let width = 0;
    let height = 0;
    let columns: number[] = [];

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      const count = Math.ceil(width / 16);
      columns = Array.from({ length: count }, () => Math.random() * -40);
    };

    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      context.fillStyle = "rgba(7, 1, 12, 0.18)";
      context.fillRect(0, 0, width, height);
      context.font = "15px ui-monospace, monospace";
      columns.forEach((y, index) => {
        const glyph = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        const x = index * 16;
        context.fillStyle = Math.random() > 0.92 ? "#ffd6ea" : "#ff4f9a";
        context.fillText(glyph, x, y * 16);
        if (y * 16 > height && Math.random() > 0.975) columns[index] = 0;
        else columns[index] = y + 1;
      });
      frame = window.requestAnimationFrame(draw);
    };

    if (reduced) {
      context.fillStyle = "#07010c";
      context.fillRect(0, 0, width, height);
    } else {
      frame = window.requestAnimationFrame(draw);
    }

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [active]);

  return <canvas ref={ref} className="matrix" aria-hidden />;
}

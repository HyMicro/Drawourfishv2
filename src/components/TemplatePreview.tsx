import { useEffect, useRef } from 'react';
import type { FishTemplate } from '../data/templates';
import { drawFishArt } from '../lib/fishArt';

interface TemplatePreviewProps {
  template: FishTemplate;
  size?: number;
  colored?: boolean;
  className?: string;
}

export function TemplatePreview({ template, size = 96, colored = true, className }: TemplatePreviewProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFishArt(ctx, template, size, {
      baseColor: colored ? template.accent : null,
      withPattern: colored,
      withShading: true,
      withEye: true,
    });
  }, [template, size, colored]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width: size, height: size, display: 'block' }}
      aria-hidden="true"
    />
  );
}

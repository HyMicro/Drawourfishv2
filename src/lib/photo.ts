import { formatDateID } from './utils';

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const srcRatio = image.width / image.height;
  const dstRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  if (srcRatio > dstRatio) {
    sw = image.height * dstRatio;
    sx = (image.width - sw) / 2;
  } else {
    sh = image.width / dstRatio;
    sy = (image.height - sh) / 2;
  }
  ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
}

/**
 * Wraps a WebGL aquarium capture in a frosted glass postcard and returns a
 * ready-to-download PNG.
 */
export function composePhoto(shot: HTMLCanvasElement): HTMLCanvasElement {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const background = ctx.createLinearGradient(0, 0, W, H);
  background.addColorStop(0, '#fff0f6');
  background.addColorStop(0.45, '#ddf8fb');
  background.addColorStop(1, '#ffe2ed');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  // Soft pastel glow.
  const glow = ctx.createRadialGradient(W * 0.24, H * 0.05, 20, W * 0.24, H * 0.05, 780);
  glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
  glow.addColorStop(0.55, 'rgba(255, 216, 231, 0.16)');
  glow.addColorStop(1, 'rgba(255, 216, 231, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Floating bubbles and little hearts.
  for (let i = 0; i < 30; i++) {
    const x = (Math.sin(i * 12.7) * 0.5 + 0.5) * W;
    const y = (Math.sin(i * 4.3) * 0.5 + 0.5) * H;
    const radius = 3 + ((i * 7) % 14);
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + (i % 4) * 0.08})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 143, 177, 0.28)';
  for (let i = 0; i < 7; i++) {
    const x = (Math.sin(i * 5.7) * 0.5 + 0.5) * W;
    const y = (Math.sin(i * 9.1) * 0.5 + 0.5) * H;
    const s = 8 + (i % 3) * 4;
    ctx.beginPath();
    ctx.arc(x - s * 0.45, y, s * 0.55, Math.PI, 0);
    ctx.arc(x + s * 0.45, y, s * 0.55, Math.PI, 0);
    ctx.lineTo(x, y + s * 0.9);
    ctx.closePath();
    ctx.fill();
  }

  // Cream sticker card with a thick white rim.
  const cardX = 56;
  const cardY = 94;
  const cardW = W - 112;
  const cardH = 1146;
  ctx.save();
  ctx.shadowColor = 'rgba(170, 111, 132, 0.26)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 28;
  roundedRect(ctx, cardX, cardY, cardW, cardH, 58);
  ctx.fillStyle = 'rgba(255, 250, 243, 0.98)';
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, cardX, cardY, cardW, cardH, 58);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.stroke();

  roundedRect(ctx, cardX + 16, cardY + 16, cardW - 32, cardH - 32, 46);
  ctx.strokeStyle = '#f6d3df';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 9]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Header.
  ctx.fillStyle = '#ff7da8';
  ctx.font = '800 22px "Nunito Variable", "Segoe UI", sans-serif';
  ctx.letterSpacing = '5px';
  ctx.fillText('SHARED LIVE REEF', cardX + 52, cardY + 70);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#5b4450';
  ctx.font = '600 74px "Fredoka Variable", ui-rounded, "Segoe UI", sans-serif';
  ctx.fillText('Draw Our Fish', cardX + 50, cardY + 154);
  ctx.font = '700 24px "Nunito Variable", "Segoe UI", sans-serif';
  ctx.fillStyle = '#a88695';
  ctx.fillText('Postcard dari akuarium bersama', cardX + 52, cardY + 196);

  // Tiny bow decoration in the top-right corner.
  const bowX = cardX + cardW - 82;
  const bowY = cardY + 78;
  ctx.fillStyle = '#ff8eb4';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(bowX - 18, bowY, 20, 14, -0.35, 0, Math.PI * 2);
  ctx.ellipse(bowX + 18, bowY, 20, 14, 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(bowX, bowY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Aquarium capture.
  const shotX = cardX + 48;
  const shotY = cardY + 234;
  const shotW = cardW - 96;
  const shotH = 566;
  ctx.save();
  roundedRect(ctx, shotX, shotY, shotW, shotH, 36);
  ctx.clip();
  drawCover(ctx, shot, shotX, shotY, shotW, shotH);
  const wash = ctx.createLinearGradient(shotX, shotY + shotH - 160, shotX, shotY + shotH);
  wash.addColorStop(0, 'rgba(2, 25, 40, 0)');
  wash.addColorStop(1, 'rgba(2, 25, 40, 0.32)');
  ctx.fillStyle = wash;
  ctx.fillRect(shotX, shotY + shotH - 160, shotW, 160);
  ctx.restore();
  roundedRect(ctx, shotX, shotY, shotW, shotH, 36);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Date & caption.
  const infoY = shotY + shotH + 92;
  ctx.fillStyle = '#d17492';
  ctx.font = '800 20px "Nunito Variable", "Segoe UI", sans-serif';
  ctx.letterSpacing = '4px';
  ctx.fillText('TANGGAL TANGKAPAN', shotX + 4, infoY);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#5b4450';
  ctx.font = '600 38px "Fredoka Variable", ui-rounded, "Segoe UI", sans-serif';
  ctx.fillText(formatDateID(new Date()), shotX + 2, infoY + 52);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#a88695';
  ctx.font = '700 24px "Nunito Variable", "Segoe UI", sans-serif';
  ctx.fillText('🐠  🫧  🎵', shotX + shotW - 4, infoY + 36);
  ctx.textAlign = 'left';

  // Footer signature.
  ctx.strokeStyle = '#f6d3df';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(cardX + 48, cardY + cardH - 128);
  ctx.lineTo(cardX + cardW - 48, cardY + cardH - 128);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#a88695';
  ctx.font = '700 21px "Nunito Variable", "Segoe UI", sans-serif';
  ctx.fillText('Setiap ikan punya cerita. Dibuat dengan imajinasi.', cardX + 50, cardY + cardH - 76);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ff7da8';
  ctx.font = '600 22px "Fredoka Variable", ui-rounded, "Segoe UI", sans-serif';
  ctx.fillText('drawourfish.app', cardX + cardW - 50, cardY + cardH - 76);
  ctx.textAlign = 'left';

  return canvas;
}

import type { FishTemplate } from '../data/templates';

interface TemplatePreviewProps {
  template: FishTemplate;
  size?: number;
  className?: string;
}

export function TemplatePreview({ template, size = 96, className }: TemplatePreviewProps) {
  if (!template.thumbUrl) return null;
  return (
    <img
      src={template.thumbUrl}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ width: size, height: size, display: 'block', objectFit: 'contain' }}
      aria-hidden="true"
    />
  );
}

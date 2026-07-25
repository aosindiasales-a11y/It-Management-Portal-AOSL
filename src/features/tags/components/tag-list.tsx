import type { Tag } from "@prisma/client";

export function TagList({ tags, max = 3 }: { tags: Tag[]; max?: number }) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = tags.slice(0, max);
  const rest = tags.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
          style={{ borderColor: `${tag.color}40`, color: tag.color, backgroundColor: `${tag.color}12` }}
        >
          {tag.name}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  );
}

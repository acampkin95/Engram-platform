import { type KBSection } from '@/app/lib/kb-data';

interface TableOfContentsProps {
  sections: KBSection[];
}

export default function TableOfContents({ sections }: TableOfContentsProps) {
  return (
    <nav className="space-y-2 sticky top-8">
      <h4 className="font-[var(--font-display)] font-semibold text-sm text-[var(--text-primary)] mb-4">
        Contents
      </h4>
      {sections.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="block text-sm text-[var(--text-secondary)] hover:text-[var(--engram-amber)] transition-colors"
        >
          {section.title}
        </a>
      ))}
    </nav>
  );
}

import type { ReactNode } from'react';

interface SettingsSectionProps {
 title: string;
 description?: string;
 children: ReactNode;
}

export default function SettingsSection({ title, description, children }: SettingsSectionProps) {
 return (
 <section className="flex flex-col gap-4">
 <div className="border-b border-border pb-3">
 <h3 className="text-base font-semibold text-text">{title}</h3>
 {description && (
 <p className="mt-0.5 text-sm text-text-dim">{description}</p>
 )}
 </div>
 <div className="flex flex-col gap-5">{children}</div>
 </section>
 );
}

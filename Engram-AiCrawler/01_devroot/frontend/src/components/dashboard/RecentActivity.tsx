import { motion } from 'framer-motion';
import { useNotificationStore } from '../../stores/notificationStore';
import { useReducedMotion, staggerContainer, staggerItem } from '../../lib/motion';

const dotColorMap: Record<string, string> = {
  success: 'bg-plasma',
  error: 'bg-neon-r',
  warning: 'bg-volt',
  info: 'bg-cyan',
};

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
  return `${Math.floor(hrs / 24)} day(s) ago`;
}

export function RecentActivity() {
  const prefersReduced = useReducedMotion();
  const notifications = useNotificationStore((s) => s.notifications);
  const recent = notifications.slice(0, 5);

  if (recent.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-text-mute mb-3">No recent activity yet.</p>
        <p className="text-xs text-text-mute">
          Activity will appear here as crawls run and data is processed.
        </p>
      </div>
    );
  }

  return (
    <motion.ul
      className="space-y-4 list-none"
      variants={prefersReduced ? undefined : staggerContainer}
      initial={prefersReduced ? undefined : 'hidden'}
      animate={prefersReduced ? undefined : 'visible'}
    >
      {recent.map((item, index) => (
        <motion.li
          key={item.id}
          variants={prefersReduced ? undefined : staggerItem}
          className="flex gap-3 relative hover:bg-surface/40 transition-colors duration-150 -mx-2 px-2 py-1"
        >
          <div className="flex flex-col items-center">
            <div
              className={`w-2.5 h-2.5 rounded-full ${dotColorMap[item.type] ?? 'bg-border'} ring-4 ring-surface z-10`}
            />
            {index !== recent.length - 1 && (
              <div className="w-px flex-1 bg-border mt-1" />
            )}
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm text-text font-medium leading-tight">
              {item.title}
            </p>
            {item.message && (
              <p className="text-xs text-text-dim mt-0.5">{item.message}</p>
            )}
            <p className="text-xs text-text-mute mt-1">{timeAgo(item.timestamp)}</p>
          </div>
        </motion.li>
      ))}
    </motion.ul>
  );
}

import { useState, useRef, useEffect, useCallback } from'react';
import {
 Bell,
 CheckCheck,
 Trash2,
 CheckCircle2,
 XCircle,
 ScanLine,
 Info,
 AlertTriangle,
} from'lucide-react';
import { useNotifications, type Notification, type NotificationEventType } from'../hooks/useNotifications';
import { useToast } from'./Toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(date: Date): string {
 const diff = Date.now() - date.getTime();
 const seconds = Math.floor(diff / 1000);
 if (seconds < 60) return'just now';
 const minutes = Math.floor(seconds / 60);
 if (minutes < 60) return `${minutes}m ago`;
 const hours = Math.floor(minutes / 60);
 if (hours < 24) return `${hours}h ago`;
 return `${Math.floor(hours / 24)}d ago`;
}

interface TypeMeta {
 icon: React.ComponentType<{ className?: string }>;
 iconClass: string;
 label: string;
}

const TYPE_META: Record<NotificationEventType, TypeMeta> = {
 crawl_complete: {
 icon: CheckCircle2,
 iconClass:'text-plasma',
 label:'Crawl complete',
 },
 crawl_error: {
 icon: XCircle,
 iconClass:'text-neon-r',
 label:'Crawl error',
 },
 scan_complete: {
 icon: ScanLine,
 iconClass:'text-cyan',
 label:'Scan complete',
 },
 system: {
 icon: Info,
 iconClass:'text-text-mute',
 label:'System',
 },
 error: {
 icon: AlertTriangle,
 iconClass:'text-neon-r',
 label:'Error',
 },
};

// ---------------------------------------------------------------------------
// Sub-component: single notification row
// ---------------------------------------------------------------------------

interface NotificationItemProps {
 notification: Notification;
 onMarkRead: (id: string) => void;
}

function NotificationItem({ notification, onMarkRead }: NotificationItemProps) {
 const meta = TYPE_META[notification.type];
 const Icon = meta.icon;

 return (
 <button
 type="button"
 onClick={() => onMarkRead(notification.id)}
 className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
 hover:bg-void
 ${!notification.read ?'bg-cyan/10' :''}`}
 >
 {/* Type icon */}
 <span
 className={`flex-shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center bg-abyss`}
 >
 <Icon className={`w-4 h-4 ${meta.iconClass}`} />
 </span>

 {/* Content */}
 <div className="flex-1 min-w-0">
 <p
 className={`text-sm leading-tight truncate
 ${notification.read
 ?'text-text-dim'
 :'font-semibold text-text'}`}
 >
 {notification.title}
 </p>
 {notification.message && (
 <p className="mt-0.5 text-xs text-text-mute line-clamp-2">
 {notification.message}
 </p>
 )}
 <p className="mt-1 text-[11px] text-text-mute">
 {formatRelativeTime(notification.timestamp)}
 </p>
 </div>

 {/* Unread dot */}
 {!notification.read && (
 <span className="flex-shrink-0 mt-2 w-2 h-2 rounded-full bg-cyan" />
 )}
 </button>
 );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function NotificationCenter() {
 const [open, setOpen] = useState(false);
 const dropdownRef = useRef<HTMLDivElement>(null);
 const toast = useToast();

 const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } =
 useNotifications();

 // Close dropdown when clicking outside
 useEffect(() => {
 function handleClickOutside(e: MouseEvent) {
 if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
 setOpen(false);
 }
 }
 if (open) {
 document.addEventListener('mousedown', handleClickOutside);
 }
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, [open]);

 // Show toast for urgent notifications as they arrive
 const prevCountRef = useRef(notifications.length);
 useEffect(() => {
 const prev = prevCountRef.current;
 const curr = notifications.length;
 prevCountRef.current = curr;

 if (curr > prev) {
 // New notification(s) arrived
 const newest = notifications[0];
 if (newest?.urgent && !newest.read) {
 toast.error(`${newest.title}: ${newest.message}`);
 }
 }
 }, [notifications, toast]);

 const handleToggle = useCallback(() => setOpen((o) => !o), []);

  const handleMarkAllRead = useCallback(() => {
    markAllAsRead();
  }, [markAllAsRead]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setOpen(false);
  }, [clearAll]);

  const handleDropdownKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = dropdownRef.current?.querySelectorAll<HTMLElement>('button[type="button"]');
        if (!items || items.length === 0) return;
        const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);
        const next = e.key === 'ArrowDown'
          ? (currentIndex + 1) % items.length
          : (currentIndex - 1 + items.length) % items.length;
        items[next].focus();
      }
    },
    [],
  );

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={open ? handleDropdownKeyDown : undefined}>
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={handleToggle}
        className="relative p-2 hover:bg-abyss focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan transition-colors"
      >
 <Bell className="w-5 h-5 text-text-dim" />

 {unreadCount > 0 && (
 <span
 className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
 flex items-center justify-center
 bg-neon-r text-text text-[10px] font-bold
 rounded-full leading-none"
 >
 {unreadCount > 99 ?'99+' : unreadCount}
 </span>
 )}
 </button>

 {/* Dropdown */}
 {open && (
 <div
 className="absolute right-0 mt-2 w-80 sm:w-96
 bg-surface
 border border-border
 shadow-black/10
 overflow-hidden z-50
 animate-slide-in"
 >
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-border">
 <h3 className="text-sm font-semibold text-text">
 Notifications
 {unreadCount > 0 && (
 <span className="ml-2 text-xs text-cyan font-normal">
 {unreadCount} unread
 </span>
 )}
 </h3>

 <div className="flex items-center gap-1">
 {unreadCount > 0 && (
 <button
 type="button"
 onClick={handleMarkAllRead}
 title="Mark all as read"
 className="p-1.5 text-text-mute hover:text-cyan
 hover:bg-abyss transition-colors"
 >
 <CheckCheck className="w-4 h-4" />
 </button>
 )}
 {notifications.length > 0 && (
 <button
 type="button"
 onClick={handleClearAll}
 title="Clear all"
 className="p-1.5 text-text-mute hover:text-neon-r
 hover:bg-abyss transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 )}
 </div>
 </div>

 {/* Notification list */}
 <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
 {notifications.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-12 gap-3 text-text-mute">
 <Bell className="w-8 h-8 opacity-30" />
 <p className="text-sm">No notifications yet</p>
 </div>
 ) : (
 notifications.map((n) => (
 <NotificationItem
 key={n.id}
 notification={n}
 onMarkRead={markAsRead}
 />
 ))
 )}
 </div>
 </div>
 )}
 </div>
 );
}

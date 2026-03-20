import { describe, expect, it } from 'vitest';
import { addToast, type ToastItem, type ToastType } from '@/src/design-system/components/Toast';

describe('Toast utilities', () => {
  it('addToast does not throw for valid types', () => {
    const types: ToastType[] = ['success', 'error', 'warning', 'info'];
    for (const type of types) {
      expect(() => addToast({ type, message: `Test ${type}` })).not.toThrow();
    }
  });

  it('addToast accepts optional duration', () => {
    expect(() => addToast({ type: 'warning', message: 'test', duration: 5000 })).not.toThrow();
  });

  it('ToastItem interface matches expected shape', () => {
    const item: ToastItem = { id: 'test-id', type: 'success', message: 'hello' };
    expect(item.id).toBe('test-id');
    expect(item.type).toBe('success');
    expect(item.message).toBe('hello');
  });

  it('ToastItem supports all toast types', () => {
    const items: ToastItem[] = [
      { id: '1', type: 'success', message: 'ok' },
      { id: '2', type: 'error', message: 'fail' },
      { id: '3', type: 'warning', message: 'warn' },
      { id: '4', type: 'info', message: 'info' },
    ];
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.type)).toEqual(['success', 'error', 'warning', 'info']);
  });
});

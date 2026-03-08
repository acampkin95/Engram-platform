import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMounted } from '@/src/hooks/useMounted';

describe('useMounted', () => {
  it('returns false before mount and true after mount effect runs', async () => {
    const { result } = renderHook(() => useMounted());

    expect(result.current).toBe(true);
  });
});

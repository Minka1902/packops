import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice', email: 'a@b.com' } }),
}));
vi.mock('@/shared/lib/firestore', () => ({
  humansCol: vi.fn(() => ({})),
  pendingCol: vi.fn(() => ({})),
}));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  writeBatch: vi.fn(() => ({ set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })),
  deleteDoc: vi.fn(),
  getFirestore: vi.fn(),
}));

import { useHumans, usePendingHumans } from '@/features/team/hooks/useHumans';

test('useHumans is exported', () => {
  expect(typeof useHumans).toBe('function');
});

test('usePendingHumans is exported', () => {
  expect(typeof usePendingHumans).toBe('function');
});

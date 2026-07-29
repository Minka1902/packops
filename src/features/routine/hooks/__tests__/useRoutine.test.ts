import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice' } }),
}));
vi.mock('@/shared/lib/firestore', () => ({ routinesCol: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn().mockResolvedValue({ id: 'r1' }),
  doc: vi.fn(() => ({})),
  deleteDoc: vi.fn(),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  getFirestore: vi.fn(),
}));

import { useRoutine } from '@/features/routine/hooks/useRoutine';

test('useRoutine is exported', () => {
  expect(typeof useRoutine).toBe('function');
});

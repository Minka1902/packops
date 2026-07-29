import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice' } }),
}));
vi.mock('@/shared/lib/firestore', () => ({
  sessionsCol: vi.fn(() => ({})),
  templatesCol: vi.fn(() => ({})),
}));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn().mockResolvedValue({ id: 's1' }),
  getDocs: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
  setDoc: vi.fn(),
  deleteDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  getFirestore: vi.fn(),
}));

import { useTraining } from '@/features/training/hooks/useTraining';

test('useTraining is exported', () => {
  expect(typeof useTraining).toBe('function');
});

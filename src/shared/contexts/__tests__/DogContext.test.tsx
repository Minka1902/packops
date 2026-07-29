import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice', email: 'a@b.com' } }),
}));
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(() => ({})),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
}));

import { DogProvider, useDog } from '@/shared/contexts/DogContext';

test('DogProvider and useDog are exported', () => {
  expect(typeof DogProvider).toBe('function');
  expect(typeof useDog).toBe('function');
});

test('DogContext constants are defined', () => {
  expect(DogProvider).toBeDefined();
  expect(useDog).toBeDefined();
});

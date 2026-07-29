import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice' } }),
}));
vi.mock('@/shared/lib/firestore', () => ({ medicalCol: vi.fn(() => ({})) }));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => () => {}),
  addDoc: vi.fn(),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(() => ({})),
  where: vi.fn(() => ({})),
  orderBy: vi.fn(() => ({})),
  getFirestore: vi.fn(),
}));

import { useMedical, useUpcomingDue } from '@/features/medical/hooks/useMedical';

test('useMedical is exported', () => { expect(typeof useMedical).toBe('function'); });
test('useUpcomingDue is exported', () => { expect(typeof useUpcomingDue).toBe('function'); });

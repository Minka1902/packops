import { vi } from 'vitest';

vi.mock('@/shared/lib/firebase', () => ({ db: {}, auth: {} }));
vi.mock('@/shared/hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1', displayName: 'Alice', phoneNumber: null } }),
}));
vi.mock('firebase/firestore', () => ({
  onSnapshot: vi.fn(() => () => {}),
  doc: vi.fn(() => ({})),
  updateDoc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => true, data: () => ({ name: 'Rex', mainHumanId: 'u1' }) }),
  getFirestore: vi.fn(),
}));

import { useQR } from '@/features/qr/hooks/useQR';

test('useQR is exported', () => { expect(typeof useQR).toBe('function'); });

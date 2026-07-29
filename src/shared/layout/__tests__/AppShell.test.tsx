import { vi } from 'vitest';

vi.mock('@/shared/hooks/useAuth', () => ({ useAuth: () => ({ user: null, logout: vi.fn() }) }));
vi.mock('@/shared/contexts/DogContext', () => ({ useDog: () => ({ activeDog: null, dogs: [], isMainHuman: () => false }) }));
vi.mock('@/shared/hooks/useAlerts', () => ({ useAlerts: () => [] }));
vi.mock('@/shared/lib/firebase', () => ({ auth: {}, db: {} }));

import AppShell from '@/shared/layout/AppShell';
import Sidebar from '@/shared/layout/Sidebar';
import Topbar from '@/shared/layout/Topbar';

test('AppShell, Sidebar and Topbar are exported', () => {
  expect(typeof AppShell).toBe('function');
  expect(typeof Sidebar).toBe('function');
  expect(typeof Topbar).toBe('function');
});

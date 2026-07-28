import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('firebase/firestore', () => ({ doc: vi.fn(), updateDoc: vi.fn() }));
vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('@/hooks/useBaseRoutine', () => ({
  useBaseRoutine: () => ({ slots: {}, save: vi.fn() }),
  makeSlotKey: (d: number, t: string) => `${d}_${t}`,
}));
vi.mock('@/hooks/useRoutine', () => ({ useRoutine: () => ({ logRoutine: vi.fn() }) }));

import { MemoryRouter } from 'react-router-dom';
import DayTimeline from '../DayTimeline';
import type { DayTimelineProps } from '../DayTimeline';

// DayTimeline navigates (tapping a walk log opens the walk), so it needs a
// router in context.
const renderTimeline = (props: DayTimelineProps) =>
  render(<MemoryRouter><DayTimeline {...props} /></MemoryRouter>);

// 2024-01-15 is a Monday
const monday = new Date(2024, 0, 15, 12, 0, 0);

const base: DayTimelineProps = {
  selectedDate: monday,
  isToday: false,
  baseSlots: {},
  allBaseSlots: {},
  onSaveBaseSlots: vi.fn(),
  logs: [],
  scheduledLogs: [],
  medicalEvents: [],
  dogId: 'dog1',
  onLogDeleted: vi.fn(),
  onScheduledLogDeleted: vi.fn(),
};

it('renders date heading for non-today', () => {
  renderTimeline(base);
  // Heading uses the short weekday format ('EEE, MMM d').
  expect(screen.getByText('Mon, Jan 15')).toBeInTheDocument();
});

it('renders "Today" heading when isToday is true', () => {
  renderTimeline({ ...base, isToday: true });
  expect(screen.getByText('Today')).toBeInTheDocument();
});

it('renders hour labels from startHour to endHour', () => {
  renderTimeline(base);
  expect(screen.getByText('06:00')).toBeInTheDocument();
  expect(screen.getByText('22:00')).toBeInTheDocument();
});

it('renders a standalone log block', () => {
  const logs = [{ id: 'l1', type: 'walk', timestamp: new Date(2024, 0, 15, 8, 0).getTime() }] as any;
  renderTimeline({ ...base, logs });
  expect(screen.getByText('Walk')).toBeInTheDocument();
});

it('renders a pending base routine block', () => {
  renderTimeline({ ...base, baseSlots: { "0_07:00": "eat" } });
  // 'eat' type label is 'Ate'
  expect(screen.getByText('Ate')).toBeInTheDocument();
});

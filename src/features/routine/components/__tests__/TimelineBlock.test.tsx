import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import TimelineBlock from '../TimelineBlock';

const base = { icon: '🐾', color: '#F59E0B', label: 'Walk', top: 100, height: 32 };

it('renders label', () => {
  render(<TimelineBlock {...base} kind="standalone-log" />);
  expect(screen.getByText('Walk')).toBeInTheDocument();
});

it('renders sublabel when provided', () => {
  render(<TimelineBlock {...base} kind="base-completed" sublabel="07:23" />);
  expect(screen.getByText('07:23')).toBeInTheDocument();
});

it('renders status badge when provided', () => {
  render(<TimelineBlock {...base} kind="scheduled-log" statusBadge={{ label: 'Scheduled', bg: '#fff', fg: '#000' }} />);
  expect(screen.getByText('Scheduled')).toBeInTheDocument();
});

// Deleting a log moved out of the block and into LogDetailSheet, which the
// block opens by calling onClick — there is no inline delete button any more.
it('calls onClick when the block is clicked', () => {
  const onClick = vi.fn();
  render(<TimelineBlock {...base} kind="standalone-log" onClick={onClick} />);
  fireEvent.click(screen.getByText('Walk'));
  expect(onClick).toHaveBeenCalledTimes(1);
});

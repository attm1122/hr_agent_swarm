import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from './MetricCard';
import { Users } from 'lucide-react';

describe('MetricCard', () => {
  it('renders title and value', () => {
    render(<MetricCard title="Total Employees" value={23} />);
    expect(screen.getByText('Total Employees')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders string value', () => {
    render(<MetricCard title="Revenue" value="$1.2M" />);
    expect(screen.getByText('$1.2M')).toBeInTheDocument();
  });

  it('renders description', () => {
    render(<MetricCard title="Test" value={5} description="vs last month" />);
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders positive change with plus sign', () => {
    render(<MetricCard title="Test" value={5} change={12} trend="up" />);
    expect(screen.getByText('+12%')).toBeInTheDocument();
  });

  it('renders negative change without plus sign', () => {
    render(<MetricCard title="Test" value={5} change={-8} trend="down" />);
    expect(screen.getByText('-8%')).toBeInTheDocument();
  });

  it('renders zero change', () => {
    render(<MetricCard title="Test" value={5} change={0} trend="neutral" />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const { container } = render(<MetricCard title="Test" value={5} icon={Users} />);
    // Icon renders as an SVG
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('does not render icon when not provided', () => {
    const { container } = render(<MetricCard title="Test" value={5} />);
    // No SVG for trending icons since no change/trend
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });

  it('renders default variant', () => {
    const { container } = render(<MetricCard title="Test" value={5} />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders emerald variant', () => {
    const { container } = render(<MetricCard title="Test" value={5} variant="emerald" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders navy variant with dark styling', () => {
    render(<MetricCard title="Test" value={5} variant="navy" />);
    const titleEl = screen.getByText('Test');
    expect(titleEl.className).toContain('text-slate-400');
  });

  it('renders amber variant', () => {
    const { container } = render(<MetricCard title="Test" value={5} variant="amber" />);
    expect(container.firstChild).toBeDefined();
  });

  it('renders red variant', () => {
    const { container } = render(<MetricCard title="Test" value={5} variant="red" />);
    expect(container.firstChild).toBeDefined();
  });

  it('does not show change section when no change or description', () => {
    const { container } = render(<MetricCard title="Test" value={5} />);
    // No trending icons or description text
    expect(container.querySelectorAll('svg').length).toBe(0);
  });

  it('renders with all props combined', () => {
    render(
      <MetricCard
        title="Full Card"
        value={42}
        change={5.2}
        trend="up"
        description="vs last month"
        icon={Users}
        variant="emerald"
      />
    );
    expect(screen.getByText('Full Card')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('+5.2%')).toBeInTheDocument();
    expect(screen.getByText('vs last month')).toBeInTheDocument();
  });

  it('renders navy variant with icon (dark icon container)', () => {
    const { container } = render(
      <MetricCard title="Dark" value={10} icon={Users} variant="navy" />
    );
    // Navy variant uses bg-slate-800 for icon container
    expect(container.querySelector('.bg-slate-800')).toBeInTheDocument();
  });

  it('renders non-navy variant with icon (light icon container)', () => {
    const { container } = render(
      <MetricCard title="Light" value={10} icon={Users} variant="default" />
    );
    expect(container.querySelector('.bg-slate-100')).toBeInTheDocument();
  });

  it('renders navy variant with change and description', () => {
    render(
      <MetricCard title="Dark Trend" value={10} change={3} trend="neutral" description="info" variant="navy" />
    );
    expect(screen.getByText('info')).toBeInTheDocument();
  });

  it('renders description only without change', () => {
    render(<MetricCard title="Test" value={5} description="only desc" />);
    expect(screen.getByText('only desc')).toBeInTheDocument();
  });
});

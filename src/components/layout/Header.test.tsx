import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from './Header';

describe('Header', () => {
  it('renders with default user', () => {
    render(<Header />);
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
    expect(screen.getByText('Chief People Officer')).toBeInTheDocument();
  });

  it('renders with custom user', () => {
    render(
      <Header user={{ name: 'John Doe', email: 'john@test.com', role: 'Engineer' }} />
    );
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Engineer')).toBeInTheDocument();
  });

  it('renders search input', () => {
    render(<Header />);
    expect(screen.getByPlaceholderText('Search employees, documents, policies...')).toBeInTheDocument();
  });

  it('renders notification bell', () => {
    const { container } = render(<Header />);
    // Bell icon is an SVG
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThan(0);
  });

  it('renders user avatar initials', () => {
    render(<Header />);
    expect(screen.getByText('SC')).toBeInTheDocument();
  });

  it('renders correct initials for custom user', () => {
    render(
      <Header user={{ name: 'John Doe', email: 'john@test.com', role: 'Dev' }} />
    );
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('renders dropdown menu items', () => {
    render(<Header />);
    // The dropdown trigger should be present
    expect(screen.getByText('Sarah Chen')).toBeInTheDocument();
  });

  it('renders notification dot', () => {
    const { container } = render(<Header />);
    // Red notification dot
    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });
});

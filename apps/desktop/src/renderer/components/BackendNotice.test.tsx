// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BackendNotice, bootstrapMessage } from './BackendNotice';

describe('bootstrapMessage', () => {
  it('explains the slow first step rather than leaving a blank screen', () => {
    expect(bootstrapMessage({ status: 'starting', stage: 'database' })).toContain('قاعدة البيانات');
  });

  it('has a distinct message for each stage, so a stuck launch shows where it stopped', () => {
    const messages = (['database', 'schema', 'server'] as const).map((stage) =>
      bootstrapMessage({ status: 'starting', stage }),
    );
    expect(new Set(messages).size).toBe(3);
  });

  it('shows the reason when startup failed, since that is what support needs', () => {
    expect(bootstrapMessage({ status: 'failed', message: 'المنفذ مشغول' })).toContain('المنفذ مشغول');
  });

  it('says nothing once the backend is ready', () => {
    expect(bootstrapMessage({ status: 'ready' })).toBeNull();
  });

  it('says nothing when this till uses another computer as its server', () => {
    expect(bootstrapMessage({ status: 'disabled' })).toBeNull();
  });
});

describe('BackendNotice', () => {
  it('renders nothing while the backend is ready', () => {
    const { container } = render(<BackendNotice status={{ status: 'ready' }} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows the current stage while starting', () => {
    render(<BackendNotice status={{ status: 'starting', stage: 'schema' }} />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

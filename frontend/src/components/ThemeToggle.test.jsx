/** Verify theme actions are explicit, keyboard accessible and correctly named. */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeToggle } from './ThemeToggle.jsx';

describe('ThemeToggle', () => {
  it.each([['light', 'Switch to dark mode'], ['dark', 'Switch to light mode']])(
    'names the destination in %s mode without activating on render', async (theme, label) => {
      const onToggle = vi.fn();
      const user = userEvent.setup();
      render(<ThemeToggle theme={theme} onToggle={onToggle} />);
      const button = screen.getByRole('button', { name: label });
      expect(button).toHaveAttribute('type', 'button');
      expect(button.className).toContain('focus-visible:ring-2');
      expect(onToggle).not.toHaveBeenCalled();
      await user.click(button);
      expect(onToggle).toHaveBeenCalledTimes(1);
    },
  );

  it('retains keyboard focus and activates once for Enter and Space', async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    render(<ThemeToggle theme="light" onToggle={onToggle} />);
    const button = screen.getByRole('button', { name: 'Switch to dark mode' });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onToggle).toHaveBeenCalledTimes(1);
    await user.keyboard(' ');
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(button).toHaveFocus();
  });
});

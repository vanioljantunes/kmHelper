import type { ReactNode } from 'react';

export interface FigureScrollProps {
  /** What this pane shows, for anyone who reaches it by keyboard or screen reader. */
  readonly label: string;
  readonly children: ReactNode;
}

/**
 * The pane the figure is panned in. It takes focus and carries a name because a region that
 * scrolls has to be reachable by keyboard, and the figure inside it is a canvas with nothing
 * tabbable of its own.
 */
export function FigureScroll({ label, children }: FigureScrollProps) {
  return (
    <div className="figure-scroll" tabIndex={0} role="group" aria-label={label}>
      {children}
    </div>
  );
}

import type { MouseEvent } from 'react';

import { useDemo } from './state';

/** Click handler that stops the click from reaching links around it, then opens the verification dialog. */
export function useGateClick() {
  const { openGate } = useDemo();
  return (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openGate();
  };
}

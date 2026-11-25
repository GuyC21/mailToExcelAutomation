/**
 * Custom hook to consume Bring-Your-Own-Key (BYOK) context state and actions.
 * @returns {object} BYOK state, active engine, and modal/key controllers.
 */
import { useContext } from 'react';
import { BYOKContext } from '../context/contexts';

export function useBYOK() {
  const context = useContext(BYOKContext);
  if (!context) {
    throw new Error('useBYOK must be used within a BYOKProvider');
  }
  return context;
}

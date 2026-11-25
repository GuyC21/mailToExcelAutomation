/**
 * Shared React Context definitions.
 * Kept separate from Provider components so Vite Fast Refresh only sees
 * React components exported from `.jsx` Provider files.
 */
import { createContext } from 'react';

export const AuthContext = createContext(null);
export const BYOKContext = createContext(null);

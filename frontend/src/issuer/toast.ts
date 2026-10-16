import { createContext, useContext } from 'react';

/** The issuer console's only shared state: the toast at the bottom. The provider is in Layout.tsx. */
export const ToastCtx = createContext<(text: string) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

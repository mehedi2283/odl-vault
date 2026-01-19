import React, { createContext, useContext } from 'react';
import { usePresence } from '../hooks/usePresence';
import { User } from '../types';

const PresenceContext = createContext<Set<string>>(new Set());

export const PresenceProvider: React.FC<{ user: User | null; children: React.ReactNode }> = ({ user, children }) => {
  const onlineUsers = usePresence(user);
  return (
    <PresenceContext.Provider value={onlineUsers}>
      {children}
    </PresenceContext.Provider>
  );
};

export const useOnlineUsers = () => useContext(PresenceContext);
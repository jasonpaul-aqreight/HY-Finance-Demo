'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type UserRole = 'admin' | 'viewer';

type RoleContextType = {
  role: UserRole;
  setRole: (role: UserRole) => void;
  isAdmin: boolean;
};

const RoleContext = createContext<RoleContextType>({
  role: 'admin',
  setRole: () => {},
  isAdmin: true,
});

export function useRole() {
  return useContext(RoleContext);
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>('admin');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('user-role') as UserRole | null;
    if (stored === 'admin' || stored === 'viewer') setRoleState(stored);
    setMounted(true);
  }, []);

  function setRole(r: UserRole) {
    setRoleState(r);
    localStorage.setItem('user-role', r);
  }

  if (!mounted) return <>{children}</>;

  return (
    <RoleContext.Provider value={{ role, setRole, isAdmin: role === 'admin' }}>
      {children}
    </RoleContext.Provider>
  );
}

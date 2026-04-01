'use client';

import { useRole, type UserRole } from '@/components/layout/RoleProvider';

export function RoleDropdown() {
  const { role, setRole } = useRole();

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium whitespace-nowrap">Role</label>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as UserRole)}
        className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
      >
        <option value="admin">Admin</option>
        <option value="viewer">Viewer</option>
      </select>
    </div>
  );
}

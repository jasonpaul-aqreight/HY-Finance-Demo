import { PureAbility } from '@casl/ability';
export type AppSubjects = 'FinanceDashboard' | 'FinanceSync' | 'FinanceSettings' | 'User' | 'Role' | 'Permission' | 'System' | 'HRData' | 'HRSync' | 'HRSettings' | 'all';
export type AppActions = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'list' | 'export' | 'approve' | 'cancel' | 'validate';
export type AppAbility = PureAbility<[AppActions, AppSubjects]>;
export interface UserPayload {
    id: string;
    role: string;
    department_code?: string;
    permissions?: string[];
}
export declare function defineAbilityFor(user: UserPayload): AppAbility;
//# sourceMappingURL=ability.service.d.ts.map
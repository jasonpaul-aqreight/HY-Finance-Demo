import { AbilityBuilder, PureAbility, createMongoAbility } from '@casl/ability';

// CASL 6 subject types for Finance module
export type AppSubjects =
  | 'FinanceDashboard'
  | 'FinanceSync'
  | 'FinanceSettings'
  | 'User'
  | 'Role'
  | 'Permission'
  | 'System'
  | 'HRData'
  | 'HRSync'
  | 'HRSettings'
  | 'all';

export type AppActions =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'manage'
  | 'list'
  | 'export'
  | 'approve'
  | 'cancel'
  | 'validate';

export type AppAbility = PureAbility<[AppActions, AppSubjects]>;

export interface UserPayload {
  id: string;
  role: string;
  department_code?: string;
  permissions?: string[];
}

export function defineAbilityFor(user: UserPayload): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  switch (user.role) {
    case 'superadmin':
      can('manage', 'all');
      break;

    case 'director':
      can('read', 'FinanceDashboard');
      can('read', 'HRData');
      can('list', 'User');
      can('export', 'FinanceDashboard');
      cannot('update', 'FinanceSettings');
      cannot('manage', 'FinanceSync');
      break;

    case 'finance':
      can('read', 'FinanceDashboard');
      can('export', 'FinanceDashboard');
      can('read', 'HRData'); // limited HR access
      cannot('manage', 'FinanceSync');
      cannot('update', 'FinanceSettings');
      break;

    case 'hr':
      can('read', 'HRData');
      can('manage', 'HRSync');
      can('update', 'HRSettings');
      cannot('read', 'FinanceDashboard');
      break;

    case 'manager':
      can('read', 'HRData');
      cannot('read', 'FinanceDashboard');
      break;

    case 'sale':
      // Sales role — no finance or HR access
      cannot('read', 'FinanceDashboard');
      cannot('read', 'HRData');
      break;

    case 'operation':
      // Operation role — no finance or HR access
      cannot('read', 'FinanceDashboard');
      cannot('read', 'HRData');
      break;

    default:
      // Unknown role — deny everything
      cannot('manage', 'all');
      break;
  }

  return build();
}

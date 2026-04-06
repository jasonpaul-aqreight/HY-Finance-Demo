import { AbilityBuilder, createMongoAbility } from '@casl/ability';
export function defineAbilityFor(user) {
    const { can, cannot, build } = new AbilityBuilder(createMongoAbility);
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
//# sourceMappingURL=ability.service.js.map
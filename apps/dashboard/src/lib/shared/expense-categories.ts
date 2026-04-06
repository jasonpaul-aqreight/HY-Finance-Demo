/**
 * Shared expense category mapping.
 *
 * Maps group-level AccNo (after ParentAccNo rollup) to a display category.
 * Used by both the Financial (P&L Statement) and Expenses pages so that
 * category names and groupings stay consistent across dashboards.
 *
 * When a new child account is created in AutoCount with a ParentAccNo,
 * it automatically inherits the parent's category — no code change needed.
 * Only brand-new standalone accounts (no parent) need to be added here;
 * until then they appear under "Other".
 */

const CATEGORY_MAP: Record<string, string> = {
  // People & Payroll
  '900-D002': 'People & Payroll',     // Director's Fees, Salaries and Etc (21 children)
  '900-S001': 'People & Payroll',     // Salaries & Related Expenses (14 children)
  '900-W001': 'People & Payroll',     // Wages for Workers (3 children)
  '900-S008': 'People & Payroll',     // Student Sponsorship Recruitment Fees (4 children)
  '900-S009': 'People & Payroll',     // Staff Company Uniform
  '900-M001': 'People & Payroll',     // Medical Expenses - Director
  '900-M002': 'People & Payroll',     // Medical Expenses - Staff
  '900-W004': 'People & Payroll',     // Foreign Worker's Working Permit
  '900-M003': 'People & Payroll',     // Messing Fees

  // Vehicle & Transport
  '900-P100': 'Vehicle & Transport',  // Petrol & Diesel Fuel Charges (17 children)
  '900-D001': 'Vehicle & Transport',  // Diesel Fees (child of 900-P100, but listed for SQL mapping)
  '900-U100': 'Vehicle & Transport',  // Upkeep of Motor Vehicle (17 children)
  '900-R001': 'Vehicle & Transport',  // Road Tax
  '900-I001': 'Vehicle & Transport',  // Insurance - Motor Ins (Commercial & Non)
  '900-P001': 'Vehicle & Transport',  // Parking and Toll
  '900-G001': 'Vehicle & Transport',  // GPS Tracking Services
  '900-T001': 'Vehicle & Transport',  // Travelling Expenses
  '900-T006': 'Vehicle & Transport',  // Transportation Expenses
  '900-A004': 'Vehicle & Transport',  // Accommodation Hotel (Outstation / Oversea)

  // Property & Utilities
  '900-R200': 'Property & Utilities', // Rental (8 children)
  '900-R210': 'Property & Utilities', // Stall Rental - Market Selayang (4 children)
  '900-E001': 'Property & Utilities', // Electricity and Water
  '900-U004': 'Property & Utilities', // Upkeep of Premises
  '900-O002': 'Property & Utilities', // Office Cleaning Fees
  '900-S007': 'Property & Utilities', // Security Expenses
  '900-D005': 'Property & Utilities', // Disposal of Rubbish
  '900-A002': 'Property & Utilities', // Assessment & Quit Rent

  // Insurance
  '900-F002': 'Insurance',            // Fire Insurance
  '900-F003': 'Insurance',            // All Risk, Burgalary & Homesecure Insurance
  '900-F004': 'Insurance',            // Trade Credit Insurance
  '900-I003': 'Insurance',            // Insurance - Medical for Staff
  '900-I004': 'Insurance',            // Term Life Insurance - GTL & GPA for Staff

  // Professional Fees
  '900-A001': 'Professional Fees',    // Audit Fee
  '900-A006': 'Professional Fees',    // Admin and Consultant Fees
  '900-P006': 'Professional Fees',    // Professional Fee
  '900-S006': 'Professional Fees',    // Secretary Fees
  '900-T004': 'Professional Fees',    // Tax Agent Fees
  '900-F001': 'Professional Fees',    // Filing Fee
  '900-A005': 'Professional Fees',    // Attestation Fees
  '900-L003': 'Professional Fees',    // Lawyer Fee

  // Finance & Banking
  '900-B001': 'Finance & Banking',    // Bank Charges
  '900-H001': 'Finance & Banking',    // Hire Purchases Interest - Exp
  '900-T003': 'Finance & Banking',    // Term Loan Interest
  '900-L001': 'Finance & Banking',    // Realised Loss on Foreign Exchange
  '900-B002': 'Finance & Banking',    // Bad Debts
  '900-B003': 'Finance & Banking',    // Bad Debts Recovery
  '900-I002': 'Finance & Banking',    // Impairment Loss on Other Receivables

  // Office & Supplies
  '900-P003': 'Office & Supplies',    // Printing & Stationery
  '900-P005': 'Office & Supplies',    // Packaging Materials
  '900-P004': 'Office & Supplies',    // Postage and Stamps, Stamping
  '900-H002': 'Office & Supplies',    // Hygiene and Cleaning Care Products
  '900-O001': 'Office & Supplies',    // Office Expenses - Toileteries, Pantry Etc
  '900-P009': 'Office & Supplies',    // Pest Control Fees

  // Equipment & IT
  '900-U002': 'Equipment & IT',       // Upkeep of Computer & Hardware
  '900-U003': 'Equipment & IT',       // Upkeep of Office Equipment
  '900-U200': 'Equipment & IT',       // Upkeep of Machinery & Equipment
  '900-U201': 'Equipment & IT',       // Upkeep of Machinery - Forklift (8FBE20-61224)
  '900-U202': 'Equipment & IT',       // Upkeep of Machinery - Forklift (8FBE20-60074)
  '900-U203': 'Equipment & IT',       // Upkeep of Machinery - Power Truck (LPE200-6960375)
  '900-U204': 'Equipment & IT',       // Upkeep of Machinery - Power Truck (LPE200-6962549)
  '900-U205': 'Equipment & IT',       // Upkeep of Machinery - Power Truck (LPE200-6954317)
  '900-U206': 'Equipment & IT',       // Upkeep of Machinery - Power Truck (LPE200-6164870)
  '900-U207': 'Equipment & IT',       // Upkeep of Machinery - Reach Truck (RRE250H-6986774)
  '900-W003': 'Equipment & IT',       // Website and Hosting Fees
  '900-T002': 'Equipment & IT',       // Telephone, Fax and Internet Fees

  // Marketing & Entertainment
  '900-E002': 'Marketing & Entertainment', // Entertainment Fees
  '900-M004': 'Marketing & Entertainment', // Marketing Cost
  '900-P008': 'Marketing & Entertainment', // Promotion Fees
  '900-A003': 'Marketing & Entertainment', // Advertisement Expenses

  // Depreciation
  '900-D003': 'Depreciation',         // Depreciation of Fixed Assets

  // Repair & Maintenance
  '900-R300': 'Repair & Maintenance', // Repair & Maintenance Fees (5 children)

  // Tax & Compliance
  '900-S004': 'Tax & Compliance',     // Sales & Services Tax (SST 8%)
  '900-P007': 'Tax & Compliance',     // Penalty and Compound Fee

  // Other standalone
  '900-C001': 'Other',                // Commission Payable
  '900-D004': 'Other',                // Donation, Condolence & Gift Sponsorship
  '900-D006': 'Other',                // E Services Online Portal & e-Docs
  '900-L002': 'Other',                // License Fee
  '900-R004': 'Other',                // Registration Fee
  '900-R005': 'Other',                // Rounding Adjustment
  '900-R006': 'Other',                // Runner & Services Charges
  '900-S002': 'Other',                // Subscription Fee
  '900-S003': 'Other',                // Survey Fees
  '900-S005': 'Other',                // Sundries Expenses
  '900-T005': 'Other',                // Training & Learning Expenses
};

/** Display order for categories */
export const CATEGORY_ORDER: string[] = [
  'People & Payroll',
  'Vehicle & Transport',
  'Property & Utilities',
  'Depreciation',
  'Office & Supplies',
  'Equipment & IT',
  'Insurance',
  'Finance & Banking',
  'Professional Fees',
  'Marketing & Entertainment',
  'Repair & Maintenance',
  'Tax & Compliance',
  'Other',
];

/**
 * Look up the expense category for a group-level AccNo
 * (i.e. COALESCE(ParentAccNo, AccNo) result).
 * Returns 'Other' for unmapped accounts.
 */
export function getExpenseCategory(groupAccNo: string): string {
  return CATEGORY_MAP[groupAccNo] ?? 'Other';
}

/**
 * Build a SQL CASE expression that maps individual AccNo → category,
 * using COALESCE(gm.ParentAccNo, gm.AccNo) so child accounts inherit
 * their parent's category automatically.
 *
 * @param gmAlias - the alias used for gl_mast / glmast table (default 'gm')
 */
export function buildCategoryCaseSQL(gmAlias = 'gm'): string {
  // Group AccNos by category
  const byCat: Record<string, string[]> = {};
  for (const [accNo, cat] of Object.entries(CATEGORY_MAP)) {
    if (!byCat[cat]) byCat[cat] = [];
    byCat[cat].push(`'${accNo}'`);
  }

  const lines = CATEGORY_ORDER.map(cat => {
    const accNos = byCat[cat];
    if (!accNos || accNos.length === 0) return null;
    return `    WHEN COALESCE(${gmAlias}.ParentAccNo, ${gmAlias}.AccNo) IN (${accNos.join(',')}) THEN '${cat}'`;
  }).filter(Boolean);

  return `CASE\n${lines.join('\n')}\n    ELSE 'Other'\n  END`;
}

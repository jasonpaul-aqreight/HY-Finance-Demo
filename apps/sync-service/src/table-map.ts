/**
 * Table mapping: AutoCount (dbo schema) → Local PostgreSQL (public schema)
 *
 * Phase 1 only: 13 lookup tables (direct copy from RDS).
 * Transaction tables are no longer synced as raw copies — they are
 * aggregated into pc_* pre-computed tables by builders.ts.
 */

export interface ColumnMap {
  src: string;
  dest: string;
}

export interface TableMapping {
  source: string;
  target: string;
  columns: ColumnMap[];
  pk: string;
  hasDateMyt?: boolean;
  dateColumn?: string;
  mytDateCol?: string;
  phase: number;
}

// ─── LOOKUP TABLES (Phase 1) ──────────────────────────────────────────────

const customer: TableMapping = {
  source: 'Debtor',
  target: 'customer',
  pk: 'DebtorCode',
  phase: 1,
  columns: [
    { src: 'AccNo', dest: 'DebtorCode' },
    { src: 'CompanyName', dest: 'CompanyName' },
    { src: 'DebtorType', dest: 'DebtorType' },
    { src: 'SalesAgent', dest: 'SalesAgent' },
    { src: 'DisplayTerm', dest: 'DisplayTerm' },
    { src: 'CreditLimit', dest: 'CreditLimit' },
    { src: 'AllowExceedCreditLimit', dest: 'AllowExceedCreditLimit' },
    { src: 'OverdueLimit', dest: 'OverdueLimit' },
    { src: 'IsActive', dest: 'IsActive' },
    { src: 'Attention', dest: 'Attention' },
    { src: 'Phone1', dest: 'Phone1' },
    { src: 'Mobile', dest: 'Mobile' },
    { src: 'EmailAddress', dest: 'EmailAddress' },
    { src: 'AreaCode', dest: 'AreaCode' },
    { src: 'CurrencyCode', dest: 'CurrencyCode' },
    { src: 'CreatedTimeStamp', dest: 'CreatedTimeStamp' },
  ],
};

const customerType: TableMapping = {
  source: 'DebtorType',
  target: 'customer_type',
  pk: 'DebtorType',
  phase: 1,
  columns: [
    { src: 'DebtorType', dest: 'DebtorType' },
    { src: 'Description', dest: 'Description' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const supplier: TableMapping = {
  source: 'Creditor',
  target: 'supplier',
  pk: 'AccNo',
  phase: 1,
  columns: [
    { src: 'AccNo', dest: 'AccNo' },
    { src: 'CompanyName', dest: 'CompanyName' },
    { src: 'CreditorType', dest: 'CreditorType' },
    { src: 'IsActive', dest: 'IsActive' },
    { src: 'Attention', dest: 'Attention' },
    { src: 'Phone1', dest: 'Phone1' },
    { src: 'Mobile', dest: 'Mobile' },
    { src: 'EmailAddress', dest: 'EmailAddress' },
    { src: 'DisplayTerm', dest: 'DisplayTerm' },
    { src: 'CreditLimit', dest: 'CreditLimit' },
    { src: 'CurrencyCode', dest: 'CurrencyCode' },
    { src: 'PurchaseAgent', dest: 'PurchaseAgent' },
    { src: 'CreatedTimeStamp', dest: 'CreatedTimeStamp' },
  ],
};

const supplierType: TableMapping = {
  source: 'CreditorType',
  target: 'supplier_type',
  pk: 'CreditorType',
  phase: 1,
  columns: [
    { src: 'CreditorType', dest: 'CreditorType' },
    { src: 'Description', dest: 'Description' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const product: TableMapping = {
  source: 'Item',
  target: 'product',
  pk: 'ItemCode',
  phase: 1,
  columns: [
    { src: 'ItemCode', dest: 'ItemCode' },
    { src: 'Description', dest: 'Description' },
    { src: 'ItemGroup', dest: 'ItemGroup' },
    { src: 'ItemType', dest: 'ItemType' },
    { src: 'UDF_BoC', dest: 'UDF_BoC' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const productGroup: TableMapping = {
  source: 'ItemGroup',
  target: 'product_group',
  pk: 'ItemGroup',
  phase: 1,
  columns: [
    { src: 'ItemGroup', dest: 'ItemGroup' },
    { src: 'Description', dest: 'Description' },
  ],
};

const salesAgent: TableMapping = {
  source: 'SalesAgent',
  target: 'sales_agent',
  pk: 'SalesAgent',
  phase: 1,
  columns: [
    { src: 'SalesAgent', dest: 'SalesAgent' },
    { src: 'Description', dest: 'Description' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const glAccount: TableMapping = {
  source: 'GLMast',
  target: 'gl_account',
  pk: 'AccNo',
  phase: 1,
  columns: [
    { src: 'AccNo', dest: 'AccNo' },
    { src: 'ParentAccNo', dest: 'ParentAccNo' },
    { src: 'Description', dest: 'Description' },
    { src: 'AccType', dest: 'AccType' },
    { src: 'SpecialAccType', dest: 'SpecialAccType' },
  ],
};

const accountType: TableMapping = {
  source: 'AccType',
  target: 'account_type',
  pk: 'AccType',
  phase: 1,
  columns: [
    { src: 'AccType', dest: 'AccType' },
    { src: 'Description', dest: 'Description' },
    { src: 'IsBSType', dest: 'IsBSType' },
  ],
};

const fiscalYear: TableMapping = {
  source: 'FiscalYear',
  target: 'fiscal_year',
  pk: 'FiscalYearName',
  phase: 1,
  columns: [
    { src: 'FiscalYearName', dest: 'FiscalYearName' },
    { src: 'FromDate', dest: 'FromDate' },
    { src: 'ToDate', dest: 'ToDate' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const project: TableMapping = {
  source: 'Project',
  target: 'project',
  pk: 'ProjNo',
  phase: 1,
  columns: [
    { src: 'ProjNo', dest: 'ProjNo' },
    { src: 'Description', dest: 'Description' },
    { src: 'IsActive', dest: 'IsActive' },
  ],
};

const plFormat: TableMapping = {
  source: 'PLFormat',
  target: 'pl_format',
  pk: 'Seq',
  phase: 1,
  columns: [
    { src: 'Seq', dest: 'Seq' },
    { src: 'RowType', dest: 'RowType' },
    { src: 'AccType', dest: 'AccType' },
    { src: 'Description', dest: 'Description' },
    { src: 'CreditAsPositive', dest: 'CreditAsPositive' },
  ],
};

const bsFormat: TableMapping = {
  source: 'BSFormat',
  target: 'bs_format',
  pk: 'Seq',
  phase: 1,
  columns: [
    { src: 'Seq', dest: 'Seq' },
    { src: 'RowType', dest: 'RowType' },
    { src: 'AccType', dest: 'AccType' },
    { src: 'Description', dest: 'Description' },
    { src: 'CreditAsPositive', dest: 'CreditAsPositive' },
  ],
};

// ─── EXPORT ─────────────────────────────────────────────────────────────

export const LOOKUP_MAPPINGS: TableMapping[] = [
  customer, customerType, supplier, supplierType,
  product, productGroup, salesAgent,
  glAccount, accountType, fiscalYear, project,
  plFormat, bsFormat,
];

-- ============================================================================
-- 002_indexes.sql — Indexes for lookup tables
-- Pre-computed table indexes are in 003_precomputed_tables.sql
-- ============================================================================

-- CUSTOMER
CREATE INDEX idx_customer_type ON customer(DebtorType);
CREATE INDEX idx_customer_agent ON customer(SalesAgent);
CREATE INDEX idx_customer_active ON customer(IsActive);

-- SUPPLIER
CREATE INDEX idx_supplier_type ON supplier(CreditorType);
CREATE INDEX idx_supplier_active ON supplier(IsActive);

-- PRODUCT
CREATE INDEX idx_product_group ON product(ItemGroup);
CREATE INDEX idx_product_fruit ON product(FruitName);

-- GL ACCOUNT
CREATE INDEX idx_gl_account_acctype ON gl_account(AccType);
CREATE INDEX idx_gl_account_parent ON gl_account(ParentAccNo);

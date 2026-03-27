# Finance Dashboard — Data Dictionary

## 1. Overview

- **Source system:** AutoCount Accounting (PostgreSQL on AWS)
- **Currency:** MYR (Malaysian Ringgit) as local/home currency
- **Total tables:** 37 (24 transaction/detail tables + 13 lookup/reference tables)
- **Organization:** Grouped by domain (Sales, Accounts Receivable, Purchasing, General Ledger, Lookup/Reference)

---

## 2. Table Inventory

| Table Name | Category | Row Count (approx) | Primary Key | Used By Dashboard |
|---|---|---|---|---|
| IV | Sales Transaction | 118,928 | DocKey | Sales, Customer Margin, Supplier Margin |
| IVDTL | Sales Detail | 1,067,985 | DtlKey | Customer Margin, Supplier Margin |
| CS | Cash Sales Transaction | 52,358 | DocKey | Sales, Customer Margin |
| CSDTL | Cash Sales Detail | 378,715 | DtlKey | Sales (fruit analysis), Customer Margin, Supplier Margin |
| CN | Credit Note Transaction | 8,746 | DocKey | Sales, Return, Customer Margin |
| CNDTL | Credit Note Detail | 59,095 | DtlKey | Return (product analysis), Customer Margin |
| DN | Debit Note Transaction | 71 | DocKey | Customer Margin |
| DNDTL | Debit Note Detail | 96 | DtlKey | Customer Margin |
| ARInvoice | AR Invoice | 171,193 | DocKey | Payment |
| ARPayment | AR Payment | 69,824 | DocKey | Payment |
| ARCN | AR Credit Note | 26,392 | DocKey | Return |
| ARPaymentKnockOff | AR Payment Knock-Off | 165,247 | KnockOffKey | Payment |
| ARRefund | AR Refund | 98 | DocKey | Return |
| ARRefundDTL | AR Refund Detail | 98 | DtlKey | Return |
| ARRefundKnockOff | AR Refund Knock-Off | 85 | KnockOffKey | Return |
| GR | Goods Receipt | 12,536 | DocKey | Supplier Margin |
| GRDTL | Goods Receipt Detail | 63,203 | DtlKey | Supplier Margin |
| PI | Purchase Invoice | 45,267 | DocKey | Supplier Margin, Expenses |
| PIDTL | Purchase Invoice Detail | 135,739 | DtlKey | Supplier Margin |
| GLDTL | GL Detail (Journal Lines) | 2,155,399 | GLDtlKey | Expenses |
| GLMast | GL Master (Chart of Accounts) | 1,576 | AccNo | Expenses, P&L |
| OBalance | Opening Balance | 344 | AutoKey | P&L |
| PBalance | Period Balance | 28,016 | AutoKey | P&L |
| Debtor | Customer Master | 710 | AccNo | Sales, Payment, Return, Customer Margin |
| DebtorType | Customer Type | 7 | DebtorType | Sales, Customer Margin |
| SalesAgent | Sales Agent | 21 | SalesAgent | Sales, Customer Margin |
| Creditor | Supplier Master | 452 | AccNo | Supplier Margin |
| CreditorType | Supplier Type | 3 | CreditorType | (Reference) |
| Item | Product Master | 6,417 | ItemCode | Supplier Margin, Customer Margin, Return |
| ItemGroup | Product Group | 7 | ItemGroup | Supplier Margin, Customer Margin |
| FiscalYear | Fiscal Year Periods | 8 | AutoKey | P&L |
| Terms | Payment Terms | 9 | AutoKey | Payment |
| AccType | Account Type | 16 | AccType | P&L |
| BSFormat | Balance Sheet Format | 12 | AutoKey | P&L |
| PLFormat | P&L Format | 12 | AutoKey | P&L |
| Project | Project/Branch | 4 | ProjNo | P&L |
| ref_countries | Country Reference | 199 | name | Sales (fruit origin) |
| ref_fruits | Fruit Name Reference | 199 | name | Sales (fruit classification) |
| ref_fruit_aliases | Fruit Alias Mapping | 12 | alias | Sales (fruit classification) |

---

## 3. Transaction Tables

### 3.1 Sales Transactions

#### IV (Invoices)

Primary sales document for credit customers. Each row is one invoice header.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key; internal document identifier |
| DocNo | VARCHAR | Human-readable invoice number (e.g., "IV-00001") |
| DocDate | TIMESTAMP | Document date (stored in UTC; add 8 hours for MYT) |
| DebtorCode | VARCHAR | FK to Debtor.AccNo; customer account code |
| DebtorName | VARCHAR | Denormalized customer name |
| Ref | VARCHAR | External reference number |
| Description | VARCHAR | Invoice description/memo |
| DisplayTerm | VARCHAR | Payment term display text |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent; assigned sales rep |
| InvAddr1–InvAddr4 | VARCHAR | Invoice address lines |
| Phone1 | VARCHAR | Customer phone |
| Fax1 | VARCHAR | Customer fax |
| Attention | VARCHAR | Attention/contact person |
| BranchCode | VARCHAR | Branch/location code |
| DeliverAddr1–DeliverAddr4 | VARCHAR | Delivery address lines |
| DeliverPhone1 | VARCHAR | Delivery phone |
| DeliverFax1 | VARCHAR | Delivery fax |
| DeliverContact | VARCHAR | Delivery contact person |
| SalesExemptionNo | VARCHAR | Tax exemption certificate number |
| SalesExemptionExpiryDate | DATE | Tax exemption expiry |
| Total | DECIMAL | Total before footer adjustments (transaction currency) |
| Footer1Param–Footer3Param | DECIMAL | Footer discount/charge parameters |
| Footer1Amt–Footer3Amt | DECIMAL | Footer discount/charge amounts (transaction currency) |
| Footer1LocalAmt–Footer3LocalAmt | DECIMAL | Footer amounts in local currency (MYR) |
| Footer1TaxCode–Footer3TaxCode | VARCHAR | Tax codes for footer items |
| CurrencyCode | VARCHAR | Transaction currency (e.g., "MYR", "SGD") |
| CurrencyRate | DECIMAL | Exchange rate to local currency |
| NetTotal | DECIMAL | Net total after discounts (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR; use for all MYR reporting |
| AnalysisNetTotal | DECIMAL | Analysis net total |
| LocalAnalysisNetTotal | DECIMAL | Analysis net total in MYR |
| LocalTotalCost | DECIMAL | Total cost in MYR (weighted-average COGS from AutoCount) |
| Tax | DECIMAL | Tax amount (transaction currency) |
| LocalTax | DECIMAL | Tax amount in MYR |
| TotalBonusPoint | DECIMAL | Loyalty bonus points earned |
| PostToStock | CHAR(1) | 'T'/'F' — whether stock was updated |
| PostToGL | CHAR(1) | 'T'/'F' — whether GL was posted |
| ReferDocKey | INTEGER | Reference to originating document |
| ReferPaymentDocKey | INTEGER | Reference to payment document |
| Transferable | CHAR(1) | Transfer status flag |
| ToDocType | VARCHAR | Target document type for transfer |
| ToDocKey | INTEGER | Target document key for transfer |
| Note | TEXT | Internal notes |
| Remark1–Remark4 | VARCHAR | Additional remark fields |
| PrintCount | INTEGER | Number of times printed |
| Cancelled | CHAR(1) | **'T' = cancelled, 'F' = active**; critical filter |
| LastModified | TIMESTAMP | Last modification timestamp |
| LastModifiedUserID | VARCHAR | User who last modified |
| CreatedTimeStamp | TIMESTAMP | Creation timestamp |
| CreatedUserID | VARCHAR | User who created |
| ExternalLink | VARCHAR | External link/attachment |
| RefDocNo | VARCHAR | Reference document number |
| CanSync | CHAR(1) | Sync eligibility flag |
| LastUpdate | TIMESTAMP | Last update timestamp |
| MemberNo | VARCHAR | Membership number |
| SalesLocation | VARCHAR | Sales outlet/location; used for outlet-based grouping |
| ExTax | DECIMAL | Amount excluding tax (transaction currency) |
| LocalExTax | DECIMAL | Amount excluding tax in MYR |
| YourPONo | VARCHAR | Customer's purchase order number |
| YourPODate | DATE | Customer's PO date |
| Guid | UUID | Global unique identifier |
| ToTaxCurrencyRate | DECIMAL | Rate for tax currency conversion |
| CalcDiscountOnUnitPrice | CHAR(1) | Discount calculation method flag |
| TaxDocNo | VARCHAR | Tax document number |
| TotalExTax | DECIMAL | Total excluding tax |
| TaxableAmt | DECIMAL | Taxable amount |
| InclusiveTax | CHAR(1) | Whether amounts include tax |
| Footer1TaxRate–Footer3TaxRate | DECIMAL | Tax rates for footer items |
| TaxDate | DATE | Tax reporting date |
| IsRoundAdj | CHAR(1) | Rounding adjustment flag |
| RoundAdj | DECIMAL | Rounding adjustment amount |
| FinalTotal | DECIMAL | Final total after rounding |
| RoundingMethod | VARCHAR | Rounding method used |
| LocalTaxableAmt | DECIMAL | Taxable amount in MYR |
| TaxCurrencyTax | DECIMAL | Tax in tax currency |
| TaxCurrencyTaxableAmt | DECIMAL | Taxable amount in tax currency |
| MultiPrice | CHAR(1) | Multi-price enabled flag |
| UDF_Status | VARCHAR | User-defined status field |
| UDF_BoCA | VARCHAR | User-defined field |
| UDF_BoCB | VARCHAR | User-defined field |
| UDF_BoI | VARCHAR | User-defined field |
| UDF_BoRemark | VARCHAR | User-defined field |
| WithholdingTax | DECIMAL | Withholding tax (transaction currency) |
| LocalWithholdingTax | DECIMAL | Withholding tax in MYR |
| TaxCurrencyWithholdingTax | DECIMAL | Withholding tax in tax currency |
| WithholdingVAT | DECIMAL | Withholding VAT |
| LocalWithholdingVAT | DECIMAL | Withholding VAT in MYR |
| TaxCurrencyWithholdingVAT | DECIMAL | Withholding VAT in tax currency |
| WHTPostingDate | DATE | Withholding tax posting date |
| TaxEntityID | VARCHAR | Tax entity identifier |
| DocStatus | VARCHAR | Document status |
| ExpiryTimeStamp | TIMESTAMP | Document expiry |
| SubmitEInvoice | CHAR(1) | E-Invoice submission flag |
| EInvoiceStatus | VARCHAR | E-Invoice status |
| EInvoiceUuid | UUID | E-Invoice unique ID |
| EInvoiceValidatedDateTime | TIMESTAMP | E-Invoice validation time |
| EInvoiceValidationLink | VARCHAR | E-Invoice validation URL |
| EInvoiceError | TEXT | E-Invoice error message |
| EInvoiceCancelDateTime | TIMESTAMP | E-Invoice cancellation time |
| EInvoiceTraceId | VARCHAR | E-Invoice trace ID |
| EInvoiceCancelReason | TEXT | E-Invoice cancellation reason |
| ... (additional E-Invoice and SG E-Invoice fields) | Various | Malaysia and Singapore e-invoicing integration fields |

#### CS (Cash Sales)

Cash sales transactions (includes POS). Structure is nearly identical to IV with the following notable differences:

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Cash sale document number |
| DocDate | TIMESTAMP | Document date (UTC; add 8h for MYT) |
| DebtorCode | VARCHAR | FK to Debtor.AccNo; may be a walk-in/generic code |
| DebtorName | VARCHAR | Customer name |
| Ref | VARCHAR | Reference number |
| Description | VARCHAR | Description/memo |
| DisplayTerm | VARCHAR | Payment term |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| LocalTotalCost | DECIMAL | Total cost in MYR |
| Tax | DECIMAL | Tax amount |
| LocalTax | DECIMAL | Tax in MYR |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| SalesLocation | VARCHAR | Outlet/location |
| PaymentMode | VARCHAR | Payment method code |
| CashPayment | DECIMAL | Cash payment received |
| CCApprovalCode | VARCHAR | Credit card approval code |
| ReallocatePurchaseByProject | CHAR(1) | Project reallocation flag |
| ... (remaining fields mirror IV) | Various | Same structure as IV |

#### CN (Credit Notes)

Customer credit notes for returns and adjustments. Structure mirrors IV with additions:

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Credit note document number |
| DocDate | TIMESTAMP | Document date (UTC; add 8h for MYT) |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| DebtorName | VARCHAR | Customer name |
| CNType | VARCHAR | Credit note type: 'RETURN' (goods returned) or others |
| Ref | VARCHAR | Reference number |
| OurInvoiceNo | VARCHAR | Original invoice number being credited |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| LocalTotalCost | DECIMAL | Total cost in MYR |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| SalesLocation | VARCHAR | Outlet/location |
| Reason | TEXT | Reason for credit note |
| ... (remaining fields mirror IV) | Various | Same structure as IV |

#### DN (Debit Notes)

Customer debit notes for additional charges. Structure mirrors CN:

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Debit note number |
| DocDate | TIMESTAMP | Document date (UTC; add 8h for MYT) |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| DebtorName | VARCHAR | Customer name |
| DNType | VARCHAR | Debit note type |
| Ref | VARCHAR | Reference number |
| OurInvoiceNo | VARCHAR | Reference invoice number |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent |
| CurrencyCode | VARCHAR | Transaction currency |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| Reason | TEXT | Reason for debit note |
| ... (remaining fields mirror IV) | Various | Same structure as IV |

### 3.2 Sales Detail Lines

#### IVDTL (Invoice Details)

Line items for each invoice. Joined to IV via DocKey.

| Column | Type | Description |
|---|---|---|
| DtlKey | INTEGER | Primary key; unique detail line identifier |
| FOCDtlKey | INTEGER | Free-of-charge detail key |
| DocKey | INTEGER | FK to IV.DocKey; parent document |
| Seq | INTEGER | Line sequence number |
| Indent | INTEGER | Indent level for grouped items |
| FontStyle | VARCHAR | Display font style |
| MainItem | CHAR(1) | Main item flag |
| Numbering | VARCHAR | Line numbering text |
| ItemCode | VARCHAR | FK to Item.ItemCode; product code |
| Location | VARCHAR | Stock location |
| BatchNo | VARCHAR | Batch number |
| Description | VARCHAR | Line item description |
| FurtherDescription | TEXT | Extended description |
| YourPONo | VARCHAR | Customer PO reference |
| YourPODate | DATE | Customer PO date |
| PostToStockDate | DATE | Stock posting date |
| ProjNo | VARCHAR | FK to Project.ProjNo |
| DeptNo | VARCHAR | Department code |
| UOM | VARCHAR | Unit of measure |
| UserUOM | VARCHAR | User-defined UOM |
| Qty | DECIMAL | Quantity sold |
| Rate | DECIMAL | Conversion rate for UOM |
| SmallestQty | DECIMAL | Quantity in smallest UOM |
| TransferedQty | DECIMAL | Quantity transferred to/from another doc |
| FOCQty | DECIMAL | Free-of-charge quantity |
| FOCTransferedQty | DECIMAL | FOC transferred quantity |
| SmallestUnitPrice | DECIMAL | Price per smallest unit |
| UnitPrice | DECIMAL | Unit price |
| Discount | VARCHAR | Discount expression (e.g., "10+5") |
| DiscountAmt | DECIMAL | Calculated discount amount |
| TaxCode | VARCHAR | Tax code |
| Tax | DECIMAL | Tax on this line |
| SubTotal | DECIMAL | Line subtotal (transaction currency) |
| LocalSubTotal | DECIMAL | Line subtotal in MYR |
| LocalTotalCost | DECIMAL | Line cost in MYR (weighted-average) |
| LocalFOCTotalCost | DECIMAL | FOC cost in MYR |
| BonusPoint | DECIMAL | Bonus points for this line |
| Transferable | CHAR(1) | Transfer flag |
| PrintOut | CHAR(1) | Print flag |
| DtlType | VARCHAR | Detail type code |
| CalcByPercent | CHAR(1) | Percentage calculation flag |
| AddToSubTotal | CHAR(1) | Include in subtotal flag |
| FromDocType | VARCHAR | Source document type |
| FromDocNo | VARCHAR | Source document number |
| FromDocDtlKey | INTEGER | Source detail key |
| AccNo | VARCHAR | GL account number |
| SubTotalExTax | DECIMAL | Subtotal excluding tax |
| LocalSubTotalExTax | DECIMAL | Subtotal ex-tax in MYR; **used for margin calculations** |
| LocalTax | DECIMAL | Tax in MYR |
| TaxableAmt | DECIMAL | Taxable amount |
| TaxRate | DECIMAL | Applied tax rate |
| ... (additional tax, tariff, and UDF fields) | Various | Extended fields |

#### CSDTL (Cash Sales Details)

Line items for cash sales. Same structure as IVDTL. Joined to CS via DocKey.

Notable columns identical to IVDTL: DtlKey, DocKey, ItemCode, Qty, UnitPrice, SubTotal, LocalSubTotal, LocalTotalCost, LocalSubTotalExTax.

#### CNDTL (Credit Note Details)

Line items for credit notes. Joined to CN via DocKey. Key difference from IVDTL:

| Column | Type | Description |
|---|---|---|
| UnitCost | DECIMAL | Unit cost at time of return; **used in margin calculations** (UnitCost * Qty) |
| GoodsReturn | CHAR(1) | 'T' if physical goods returned, 'F' if credit-only adjustment |
| ... (remaining fields mirror IVDTL) | Various | Same structure |

#### DNDTL (Debit Note Details)

Line items for debit notes. Joined to DN via DocKey. Same structure as IVDTL with LocalTotalCost for cost tracking.

### 3.3 Accounts Receivable

#### ARInvoice

AR sub-ledger invoice records. One row per invoice posted to AR. Tracks outstanding balances.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | AR invoice number |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| JournalType | VARCHAR | Journal type code |
| DocDate | TIMESTAMP | Document date (UTC; add 8h for MYT) |
| DisplayTerm | VARCHAR | Payment term display text |
| DueDate | TIMESTAMP | Payment due date; **critical for overdue calculations** |
| Description | VARCHAR | Description |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| Total | DECIMAL | Total amount (transaction currency) |
| LocalTotal | DECIMAL | Total in MYR |
| Tax | DECIMAL | Tax (transaction currency) |
| LocalTax | DECIMAL | Tax in MYR |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| PaymentAmt | DECIMAL | Amount paid (transaction currency) |
| LocalPaymentAmt | DECIMAL | Amount paid in MYR |
| Outstanding | DECIMAL | **Outstanding balance**; key field for payment dashboard |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| AgingDate | DATE | Date used for aging calculations |
| ... (remaining administrative fields) | Various | Audit, tax, and e-invoice fields |

#### ARPayment

Customer payment receipts. Tracks collections against invoices.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Payment receipt number |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| DocDate | TIMESTAMP | Payment date (UTC; add 8h for MYT) |
| Description | VARCHAR | Payment description |
| ProjNo | VARCHAR | FK to Project.ProjNo |
| DeptNo | VARCHAR | Department code |
| CurrencyCode | VARCHAR | Payment currency |
| ToDebtorRate | DECIMAL | Conversion rate to debtor currency |
| ToHomeRate | DECIMAL | Conversion rate to MYR |
| PaymentAmt | DECIMAL | Payment amount (transaction currency) |
| LocalPaymentAmt | DECIMAL | **Payment amount in MYR**; primary collection metric |
| KnockOffAmt | DECIMAL | Amount applied to invoices |
| LocalUnappliedAmount | DECIMAL | Unapplied amount in MYR |
| RefundAmt | DECIMAL | Refund amount |
| CBKey | INTEGER | Cash book key |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| HandOverDate | DATE | Payment handover date |
| ReferCNDocKey | INTEGER | Related credit note DocKey |
| ReferCNDocDate | DATE | Related CN date |
| ReferCNDocNo | VARCHAR | Related CN number |
| ... (remaining fields) | Various | Audit and administrative fields |

#### ARCN (AR Credit Note)

AR sub-ledger credit notes. Tracks credit note application and refund status.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | AR credit note number |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| JournalType | VARCHAR | Journal type |
| CNType | VARCHAR | **Credit note type** ('RETURN' for goods returns) |
| Ref | VARCHAR | Reference |
| DocDate | TIMESTAMP | Document date (UTC; add 8h for MYT) |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| Total | DECIMAL | Total (transaction currency) |
| LocalTotal | DECIMAL | Total in MYR |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| KnockOffAmt | DECIMAL | Amount applied against invoices |
| RefundAmt | DECIMAL | Amount refunded to customer |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| OurInvoiceNo | VARCHAR | Original invoice number |
| Reason | TEXT | Reason for credit note |
| ... (remaining fields) | Various | Tax, e-invoice, and audit fields |

#### ARPaymentKnockOff

Junction table linking payments to invoices they settle.

| Column | Type | Description |
|---|---|---|
| KnockOffKey | INTEGER | Primary key |
| DocKey | INTEGER | FK to ARPayment.DocKey; the payment document |
| KnockOffDocType | VARCHAR | Type of document being settled |
| KnockOffDocKey | INTEGER | FK to ARInvoice.DocKey; the invoice being settled |
| Amount | DECIMAL | Amount applied from payment to invoice |
| GainLossDate | DATE | Date for gain/loss calculation |
| Revalue | DECIMAL | Revaluation amount |
| DiscountAmt | DECIMAL | Discount amount given |
| ProjNo | VARCHAR | Project code |
| DeptNo | VARCHAR | Department code |
| UseProjDept | CHAR(1) | Use project/dept flag |
| FCRevalueKey | INTEGER | FC revaluation key |

#### ARRefund

Customer refund header. Created when refunding credit note amounts.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Refund document number |
| DebtorCode | VARCHAR | FK to Debtor.AccNo |
| DocDate | TIMESTAMP | Refund date |
| PaymentAmt | DECIMAL | Refund amount (transaction currency) |
| LocalPaymentAmt | DECIMAL | Refund amount in MYR |
| KnockOffAmt | DECIMAL | Amount knocked off |
| CBKey | INTEGER | Cash book key |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| ... (remaining fields) | Various | Audit and e-invoice fields |

#### ARRefundDTL

Refund payment method details.

| Column | Type | Description |
|---|---|---|
| DtlKey | INTEGER | Primary key |
| DocKey | INTEGER | FK to ARRefund.DocKey |
| Seq | INTEGER | Sequence number |
| PaymentMethod | VARCHAR | Payment method (cash, cheque, etc.) |
| PaymentBy | VARCHAR | Paid by (bank name, etc.) |
| ToBankRate | DECIMAL | Bank conversion rate |
| ChequeNo | VARCHAR | Cheque number |
| PaymentAmt | DECIMAL | Payment detail amount |
| DebtorPaymentAmt | DECIMAL | Amount in debtor currency |
| LocalPaymentAmt | DECIMAL | Amount in MYR |
| ... (remaining fields) | Various | Bank charge and tax fields |

#### ARRefundKnockOff

Junction table linking refunds to the credit notes they settle.

| Column | Type | Description |
|---|---|---|
| KnockOffKey | INTEGER | Primary key |
| DocKey | INTEGER | FK to ARRefund.DocKey |
| KnockOffDocType | VARCHAR | Document type being settled |
| KnockOffDocKey | INTEGER | FK to ARCN.DocKey |
| Amount | DECIMAL | Knock-off amount |
| ... (remaining fields) | Various | Revaluation fields |

### 3.4 Purchase Transactions

#### GR (Goods Receipts)

Records goods received from suppliers before purchase invoice.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Goods receipt number |
| DocDate | TIMESTAMP | Receipt date (UTC; add 8h for MYT) |
| CreditorCode | VARCHAR | FK to Creditor.AccNo; supplier code |
| CreditorName | VARCHAR | Supplier name |
| Ref | VARCHAR | Reference number |
| SupplierDONo | VARCHAR | Supplier delivery order number |
| Description | VARCHAR | Description |
| DisplayTerm | VARCHAR | Payment term |
| PurchaseAgent | VARCHAR | Purchasing agent |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| Tax | DECIMAL | Tax amount |
| LocalTax | DECIMAL | Tax in MYR |
| ForeignCharges | DECIMAL | Foreign charges (transaction currency) |
| LocalCharges | DECIMAL | Charges in MYR |
| LandedCostMethod | VARCHAR | Landed cost allocation method |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| PurchaseLocation | VARCHAR | Purchase location |
| ... (remaining fields) | Various | Audit, transfer, tax fields |

#### GRDTL (Goods Receipt Details)

Line items for goods receipts. Joined to GR via DocKey.

| Column | Type | Description |
|---|---|---|
| DtlKey | INTEGER | Primary key |
| DocKey | INTEGER | FK to GR.DocKey |
| ItemCode | VARCHAR | FK to Item.ItemCode |
| Description | VARCHAR | Line description |
| Qty | DECIMAL | Quantity received |
| UnitPrice | DECIMAL | Unit price |
| SubTotal | DECIMAL | Line subtotal (transaction currency) |
| LocalSubTotal | DECIMAL | Line subtotal in MYR |
| ForeignCharges | DECIMAL | Line foreign charges |
| LocalCharges | DECIMAL | Line local charges |
| Duty | DECIMAL | Import duty |
| ... (remaining fields mirror IVDTL) | Various | UOM, tax, batch, location fields |

#### PI (Purchase Invoices)

Supplier invoices for purchased goods. Primary table for COGS calculations.

| Column | Type | Description |
|---|---|---|
| DocKey | INTEGER | Primary key |
| DocNo | VARCHAR | Purchase invoice number |
| DocDate | TIMESTAMP | Invoice date (UTC; add 8h for MYT) |
| CreditorCode | VARCHAR | FK to Creditor.AccNo; supplier code |
| CreditorName | VARCHAR | Supplier name |
| Ref | VARCHAR | Reference number |
| SupplierDONo | VARCHAR | Supplier DO number |
| SupplierInvoiceNo | VARCHAR | Supplier's own invoice number |
| DisplayTerm | VARCHAR | Payment term |
| PurchaseAgent | VARCHAR | Purchasing agent |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| NetTotal | DECIMAL | Net total (transaction currency) |
| LocalNetTotal | DECIMAL | Net total in MYR |
| Tax | DECIMAL | Tax amount |
| LocalTax | DECIMAL | Tax in MYR |
| ForeignCharges | DECIMAL | Foreign charges |
| LocalCharges | DECIMAL | Local charges |
| Cancelled | CHAR(1) | 'T'/'F' cancellation flag |
| PurchaseLocation | VARCHAR | Purchase location |
| ... (remaining fields) | Various | Audit, transfer, tax, e-invoice fields |

#### PIDTL (Purchase Invoice Details)

Line items for purchase invoices. Joined to PI via DocKey. **Primary source for purchase cost in margin calculations.**

| Column | Type | Description |
|---|---|---|
| DtlKey | INTEGER | Primary key |
| DocKey | INTEGER | FK to PI.DocKey |
| ItemCode | VARCHAR | FK to Item.ItemCode |
| Description | VARCHAR | Line description |
| Qty | DECIMAL | **Quantity purchased** |
| UnitPrice | DECIMAL | **Unit purchase price** |
| SubTotal | DECIMAL | Line subtotal (transaction currency) |
| LocalSubTotal | DECIMAL | **Line subtotal in MYR; used for COGS calculation** |
| LocalSubTotalExTax | DECIMAL | Subtotal ex-tax in MYR |
| ForeignCharges | DECIMAL | Foreign charges for this line |
| LocalCharges | DECIMAL | Local charges for this line |
| Duty | DECIMAL | Import duty for this line |
| CNAmt | DECIMAL | Credit note amount applied |
| ... (remaining fields mirror GRDTL) | Various | UOM, tax, batch fields |

### 3.5 General Ledger

#### GLDTL (GL Detail / Journal Lines)

Individual general ledger journal entries. Each row is one debit or credit line.

| Column | Type | Description |
|---|---|---|
| GLDtlKey | INTEGER | Primary key |
| AccNo | VARCHAR | FK to GLMast.AccNo; GL account code |
| DEAccNo | VARCHAR | Contra account code |
| JournalType | VARCHAR | Journal type code |
| ProjNo | VARCHAR | FK to Project.ProjNo |
| DeptNo | VARCHAR | Department code |
| CurrencyCode | VARCHAR | Transaction currency |
| CurrencyRate | DECIMAL | Exchange rate |
| ToHomeRate | DECIMAL | Rate to home currency |
| OrgDR | DECIMAL | Original debit (transaction currency) |
| OrgCR | DECIMAL | Original credit (transaction currency) |
| DR | DECIMAL | Debit amount |
| CR | DECIMAL | Credit amount |
| HomeDR | DECIMAL | **Debit in MYR**; used in expense calculations |
| HomeCR | DECIMAL | **Credit in MYR**; used in expense calculations |
| TransDate | TIMESTAMP | **Transaction date** (UTC; add 8h for MYT) |
| Description | VARCHAR | Journal line description |
| RefNo1 | VARCHAR | Reference number 1 |
| RefNo2 | VARCHAR | Reference number 2 |
| DEKey | INTEGER | Data entry key |
| UserID | VARCHAR | User who posted |
| SourceType | VARCHAR | Source document type |
| SourceKey | INTEGER | Source document key |
| TaxCode | VARCHAR | Tax code |
| GLTrxID | INTEGER | GL transaction ID |
| SourceDtlKey | INTEGER | Source detail key |
| PaymentDocType | VARCHAR | Payment document type |
| PaymentDocKey | INTEGER | Payment document key |

#### GLMast (GL Master / Chart of Accounts)

Master list of all GL accounts in the chart of accounts.

| Column | Type | Description |
|---|---|---|
| AccNo | VARCHAR | **Primary key**; account code (e.g., "600-0000", "900-S001") |
| ParentAccNo | VARCHAR | Parent account for hierarchy |
| Description | VARCHAR | Account description/name |
| Desc2 | VARCHAR | Secondary description |
| AccType | VARCHAR | **FK to AccType.AccType**; account type code (SL, CO, EP, OI, etc.) |
| SpecialAccType | VARCHAR | Special account type |
| CurrencyCode | VARCHAR | Default currency for this account |
| CashFlowCategory | VARCHAR | Cash flow statement classification |
| MSICCode | VARCHAR | MSIC industry code |
| InputTaxCode | VARCHAR | Default input tax code |
| OutputTaxCode | VARCHAR | Default output tax code |
| TariffCode | VARCHAR | Tariff code |
| Guid | UUID | Global unique identifier |
| SGeFilingDataId | VARCHAR | SG e-filing identifier |

#### OBalance (Opening Balance)

Opening balance entries for each period/account combination.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| PeriodNo | INTEGER | Period number (fiscal period identifier) |
| AccNo | VARCHAR | FK to GLMast.AccNo |
| ProjNo | VARCHAR | FK to Project.ProjNo |
| DeptNo | VARCHAR | Department code |
| DR | DECIMAL | Debit (transaction currency) |
| CR | DECIMAL | Credit (transaction currency) |
| HomeDR | DECIMAL | Debit in MYR |
| HomeCR | DECIMAL | Credit in MYR |

#### PBalance (Period Balance)

Period-end balance for each GL account. Primary data source for P&L and Balance Sheet reports.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| PeriodNo | INTEGER | **Period number**; maps to fiscal months |
| AccNo | VARCHAR | FK to GLMast.AccNo |
| ProjNo | VARCHAR | FK to Project.ProjNo |
| DeptNo | VARCHAR | Department code |
| DR | DECIMAL | Debit (transaction currency) |
| CR | DECIMAL | Credit (transaction currency) |
| HomeDR | DECIMAL | **Debit in MYR**; used in P&L calculations |
| HomeCR | DECIMAL | **Credit in MYR**; used in P&L calculations |
| Computed_PeriodNo_AccNo_ProjNo_DeptNo | VARCHAR | Composite computed key |

---

## 4. Lookup/Reference Tables

### 4.1 Customer Data

#### Debtor (Customer Master)

Master list of all customers (debtors). Mapped from AutoCount's Debtor table.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| AccNo | VARCHAR | **Primary key**; customer account code (= DebtorCode in transactions) |
| CompanyName | VARCHAR | Company/customer name |
| Desc2 | VARCHAR | Secondary description |
| RegisterNo | VARCHAR | Business registration number |
| Address1–Address4 | VARCHAR | Primary address lines |
| PostCode | VARCHAR | Postal code |
| DeliverAddr1–DeliverAddr4 | VARCHAR | Delivery address lines |
| DeliverPostCode | VARCHAR | Delivery postal code |
| Attention | VARCHAR | Contact person |
| Phone1, Phone2 | VARCHAR | Phone numbers |
| Fax1, Fax2 | VARCHAR | Fax numbers |
| AreaCode | VARCHAR | Area code |
| SalesAgent | VARCHAR | FK to SalesAgent.SalesAgent; default sales rep |
| DebtorType | VARCHAR | FK to DebtorType.DebtorType; customer classification |
| NatureOfBusiness | VARCHAR | Business nature description |
| WebURL | VARCHAR | Website |
| EmailAddress | VARCHAR | Email |
| DisplayTerm | VARCHAR | Default payment term |
| CreditLimit | DECIMAL | **Credit limit in MYR**; used in credit utilization |
| AgingOn | VARCHAR | Aging calculation basis |
| StatementType | VARCHAR | Statement format preference |
| CurrencyCode | VARCHAR | Default currency |
| AllowExceedCreditLimit | CHAR(1) | Override credit limit flag |
| OverdueLimit | DECIMAL | **Overdue limit**; threshold for credit score breach |
| IsActive | CHAR(1) | **'T' = active, 'F' = inactive**; used to filter customers |
| IsGroupCompany | CHAR(1) | Group company flag |
| IsCashSaleDebtor | CHAR(1) | Cash sale debtor flag |
| ... (remaining fields) | Various | Tax, discount, block status, UDF fields |

#### DebtorType (Customer Type)

Customer classification types.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| DebtorType | VARCHAR | **Primary key**; type code |
| Description | VARCHAR | Type description (e.g., "Wholesale", "Retail") |
| Desc2 | VARCHAR | Secondary description |
| IsActive | CHAR(1) | Active flag |
| LastUpdate | TIMESTAMP | Last update |
| Guid | UUID | Global identifier |

#### SalesAgent

Sales representative/agent master.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| SalesAgent | VARCHAR | **Primary key**; agent code |
| Description | VARCHAR | Agent name |
| Desc2 | VARCHAR | Secondary description |
| IsActive | CHAR(1) | **'T'/'F' active flag**; shown in dashboard |
| LastUpdate | TIMESTAMP | Last update |
| Signature | TEXT | Signature data |
| Guid | UUID | Global identifier |
| EmailAddress | VARCHAR | Email |
| ApproverEmailAddress | VARCHAR | Approver email |
| UDF_Bo | VARCHAR | User-defined field |

### 4.2 Supplier Data

#### Creditor (Supplier Master)

Master list of all suppliers (creditors).

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| AccNo | VARCHAR | **Primary key**; supplier account code (= CreditorCode in transactions) |
| CompanyName | VARCHAR | Supplier name |
| Desc2 | VARCHAR | Secondary description |
| RegisterNo | VARCHAR | Business registration number |
| Address1–Address4 | VARCHAR | Address lines |
| Phone1, Phone2 | VARCHAR | Phone numbers |
| Fax1, Fax2 | VARCHAR | Fax numbers |
| PurchaseAgent | VARCHAR | Default purchase agent |
| CreditorType | VARCHAR | FK to CreditorType.CreditorType; supplier classification |
| EmailAddress | VARCHAR | Email |
| DisplayTerm | VARCHAR | Default payment term |
| CreditLimit | DECIMAL | Credit limit |
| CurrencyCode | VARCHAR | Default currency |
| IsActive | CHAR(1) | **'T' = active**; used to filter suppliers in margin dashboard |
| OverdueLimit | DECIMAL | Overdue limit |
| ... (remaining fields) | Various | Tax, discount, block status fields |

#### CreditorType (Supplier Type)

Supplier classification types.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| CreditorType | VARCHAR | **Primary key**; type code |
| Description | VARCHAR | Type description |
| Desc2 | VARCHAR | Secondary description |
| IsActive | CHAR(1) | Active flag |
| LastUpdate | TIMESTAMP | Last update |

### 4.3 Product Data

#### Item (Product Master)

Master list of all products/items.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| ItemCode | VARCHAR | **Primary key**; product code |
| DocKey | INTEGER | Document key reference |
| Description | VARCHAR | Product description |
| Desc2 | VARCHAR | Secondary description |
| FurtherDescription | TEXT | Extended description |
| ItemGroup | VARCHAR | FK to ItemGroup.ItemGroup; product group classification |
| ItemType | VARCHAR | Item type code |
| AssemblyCost | DECIMAL | Assembly/manufacturing cost |
| LeadTime | INTEGER | Lead time |
| StockControl | CHAR(1) | Stock tracking flag |
| HasSerialNo | CHAR(1) | Serial number tracking |
| HasBatchNo | CHAR(1) | Batch tracking |
| DutyRate | DECIMAL | Import duty rate |
| TaxCode | VARCHAR | Default tax code |
| CostingMethod | VARCHAR | Costing method (e.g., weighted average) |
| SalesUOM | VARCHAR | Default sales unit of measure |
| PurchaseUOM | VARCHAR | Default purchase UOM |
| ReportUOM | VARCHAR | Reporting UOM |
| IsActive | CHAR(1) | Active flag |
| Discontinued | CHAR(1) | Discontinued flag |
| BaseUOM | VARCHAR | Base unit of measure |
| IsSalesItem | CHAR(1) | Can be sold |
| IsPurchaseItem | CHAR(1) | Can be purchased |
| MainSupplier | VARCHAR | Primary supplier code |
| ItemBrand | VARCHAR | Brand |
| ItemClass | VARCHAR | Class |
| ItemCategory | VARCHAR | Category |
| ... (remaining fields) | Various | UDF, sync, and configuration fields |

#### ItemGroup (Product Group)

Product group classifications.

| Column | Type | Description |
|---|---|---|
| ItemGroup | VARCHAR | **Primary key**; group code |
| Description | VARCHAR | Group description |
| Desc2 | VARCHAR | Secondary description |
| Note | TEXT | Notes |
| SalesCode | VARCHAR | Default sales GL account |
| CashSalesCode | VARCHAR | Default cash sales GL account |
| SalesReturnCode | VARCHAR | Default sales return GL account |
| SalesDiscountCode | VARCHAR | Default sales discount GL account |
| PurchaseDiscountCode | VARCHAR | Default purchase discount GL account |
| PurchaseCode | VARCHAR | Default purchase GL account |
| PurchaseReturnCode | VARCHAR | Default purchase return GL account |
| BalanceStockCode | VARCHAR | Stock balance GL account |
| CashPurchaseCode | VARCHAR | Cash purchase GL account |
| ... (remaining fields) | Various | Sync and configuration fields |

### 4.4 Configuration

#### FiscalYear

Fiscal year period definitions.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| FiscalYearName | VARCHAR | **Fiscal year name** (e.g., "FY2025"); parsed for period calculations |
| FromDate | DATE | Fiscal year start date |
| ToDate | DATE | Fiscal year end date |
| IsActive | CHAR(1) | Active flag |

#### Terms (Payment Terms)

Payment term definitions.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| DisplayTerm | VARCHAR | Display text (e.g., "Net 30") |
| Terms | VARCHAR | Terms code |
| LastUpdate | TIMESTAMP | Last update |
| TermType | VARCHAR | Term type (days, month-end, etc.) |
| TermDays | INTEGER | **Number of days**; used to compute due dates |
| DiscountDays | INTEGER | Early payment discount days |
| DiscountPercent | DECIMAL | Early payment discount percentage |

#### AccType (Account Type)

GL account type classifications.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Auto-increment key |
| AccType | VARCHAR | **Primary key**; type code (SL=Sales, CO=COGS, EP=Expenses, OI=Other Income, etc.) |
| Description | VARCHAR | Type description |
| Desc2 | VARCHAR | Secondary description |
| IsBSType | CHAR(1) | **'T' = Balance Sheet type, 'F' = P&L type**; controls report placement |
| IsSystemType | CHAR(1) | System-defined (non-deletable) flag |

#### BSFormat (Balance Sheet Format)

Balance sheet presentation format.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| Seq | INTEGER | Display sequence order |
| RowType | VARCHAR | Row type |
| AccType | VARCHAR | FK to AccType.AccType |
| Description | VARCHAR | Line description |
| CreditAsPositive | CHAR(1) | 'T' = credit balance shown as positive |

#### PLFormat (P&L Format)

Profit & Loss statement presentation format.

| Column | Type | Description |
|---|---|---|
| AutoKey | INTEGER | Primary key |
| Seq | INTEGER | **Display sequence order**; controls P&L line ordering |
| RowType | VARCHAR | Row type |
| AccType | VARCHAR | FK to AccType.AccType |
| Description | VARCHAR | Line description |
| CreditAsPositive | CHAR(1) | **'T' = credit as positive**; controls sign convention for revenue vs expense |

#### Project

Project/branch master for multi-project reporting.

| Column | Type | Description |
|---|---|---|
| ProjNo | VARCHAR | **Primary key**; project code |
| ParentProjNo | VARCHAR | Parent project for hierarchy |
| Description | VARCHAR | Project name |
| Desc2 | VARCHAR | Secondary description |
| IsActive | CHAR(1) | Active flag |
| LastUpdate | TIMESTAMP | Last update |
| Guid | UUID | Global identifier |

### 4.5 Reference (Dashboard-Specific)

These tables are created for the dashboard's fruit classification feature. They are not part of the AutoCount schema.

#### ref_countries

Country reference for fruit origin classification.

| Column | Type | Description |
|---|---|---|
| name | VARCHAR | **Primary key**; country name |
| abbreviation | VARCHAR | Country abbreviation |

#### ref_fruits

Standard fruit name reference list.

| Column | Type | Description |
|---|---|---|
| name | VARCHAR | **Primary key**; standardized fruit name |

#### ref_fruit_aliases

Maps variant/alias fruit names to standard names.

| Column | Type | Description |
|---|---|---|
| alias | VARCHAR | **Primary key**; alias or variant name found in item descriptions |
| standard_name | VARCHAR | FK to ref_fruits.name; mapped standard fruit name |

---

## 5. Table Relationships

### 5.1 Entity-Relationship Summary

```
Debtor (AccNo)
  ├── IV.DebtorCode
  ├── CS.DebtorCode
  ├── CN.DebtorCode
  ├── DN.DebtorCode
  ├── ARInvoice.DebtorCode
  ├── ARPayment.DebtorCode
  ├── ARCN.DebtorCode
  └── ARRefund.DebtorCode

Creditor (AccNo)
  ├── GR.CreditorCode
  └── PI.CreditorCode

Item (ItemCode)
  ├── IVDTL.ItemCode
  ├── CSDTL.ItemCode
  ├── CNDTL.ItemCode
  ├── DNDTL.ItemCode
  ├── GRDTL.ItemCode
  └── PIDTL.ItemCode

GLMast (AccNo)
  ├── GLDTL.AccNo
  ├── OBalance.AccNo
  └── PBalance.AccNo

Document Header → Detail (via DocKey)
  IV → IVDTL
  CS → CSDTL
  CN → CNDTL
  DN → DNDTL
  GR → GRDTL
  PI → PIDTL
  ARRefund → ARRefundDTL

Payment Knock-Off Chains
  ARPayment → ARPaymentKnockOff → ARInvoice
  ARRefund → ARRefundKnockOff → ARCN
```

### 5.2 Foreign Key Reference Table

| From Table.Column | To Table.Column | Relationship | Notes |
|---|---|---|---|
| IV.DebtorCode | Debtor.AccNo | Many-to-One | Customer on invoice |
| IV.SalesAgent | SalesAgent.SalesAgent | Many-to-One | Assigned sales rep |
| CS.DebtorCode | Debtor.AccNo | Many-to-One | Customer on cash sale |
| CS.SalesAgent | SalesAgent.SalesAgent | Many-to-One | Assigned sales rep |
| CN.DebtorCode | Debtor.AccNo | Many-to-One | Customer on credit note |
| CN.SalesAgent | SalesAgent.SalesAgent | Many-to-One | Assigned sales rep |
| DN.DebtorCode | Debtor.AccNo | Many-to-One | Customer on debit note |
| DN.SalesAgent | SalesAgent.SalesAgent | Many-to-One | Assigned sales rep |
| IVDTL.DocKey | IV.DocKey | Many-to-One | Invoice line items |
| IVDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| CSDTL.DocKey | CS.DocKey | Many-to-One | Cash sale line items |
| CSDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| CNDTL.DocKey | CN.DocKey | Many-to-One | Credit note line items |
| CNDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| DNDTL.DocKey | DN.DocKey | Many-to-One | Debit note line items |
| DNDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| GRDTL.DocKey | GR.DocKey | Many-to-One | Goods receipt line items |
| GRDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| PIDTL.DocKey | PI.DocKey | Many-to-One | Purchase invoice line items |
| PIDTL.ItemCode | Item.ItemCode | Many-to-One | Product on line |
| PI.CreditorCode | Creditor.AccNo | Many-to-One | Supplier on purchase invoice |
| GR.CreditorCode | Creditor.AccNo | Many-to-One | Supplier on goods receipt |
| ARInvoice.DebtorCode | Debtor.AccNo | Many-to-One | Customer on AR invoice |
| ARPayment.DebtorCode | Debtor.AccNo | Many-to-One | Customer on payment |
| ARCN.DebtorCode | Debtor.AccNo | Many-to-One | Customer on AR credit note |
| ARRefund.DebtorCode | Debtor.AccNo | Many-to-One | Customer on refund |
| ARRefundDTL.DocKey | ARRefund.DocKey | Many-to-One | Refund payment details |
| ARPaymentKnockOff.DocKey | ARPayment.DocKey | Many-to-One | Payment that settles |
| ARPaymentKnockOff.KnockOffDocKey | ARInvoice.DocKey | Many-to-One | Invoice being settled |
| ARRefundKnockOff.DocKey | ARRefund.DocKey | Many-to-One | Refund that settles |
| ARRefundKnockOff.KnockOffDocKey | ARCN.DocKey | Many-to-One | Credit note being settled |
| Debtor.DebtorType | DebtorType.DebtorType | Many-to-One | Customer classification |
| Debtor.SalesAgent | SalesAgent.SalesAgent | Many-to-One | Default sales rep |
| Creditor.CreditorType | CreditorType.CreditorType | Many-to-One | Supplier classification |
| Item.ItemGroup | ItemGroup.ItemGroup | Many-to-One | Product group classification |
| GLDTL.AccNo | GLMast.AccNo | Many-to-One | GL account for journal line |
| OBalance.AccNo | GLMast.AccNo | Many-to-One | Account for opening balance |
| PBalance.AccNo | GLMast.AccNo | Many-to-One | Account for period balance |
| GLMast.AccType | AccType.AccType | Many-to-One | Account type classification |
| BSFormat.AccType | AccType.AccType | Many-to-One | BS format line to account type |
| PLFormat.AccType | AccType.AccType | Many-to-One | P&L format line to account type |
| ref_fruit_aliases.standard_name | ref_fruits.name | Many-to-One | Alias to standard fruit name |

---

## 6. Business Rules

### 6.1 Revenue Calculation

**Formula:**

```
Net Revenue = SUM(IV.NetTotal) + SUM(CS.NetTotal) - SUM(CN.NetTotal)
```

- All sums filtered by `Cancelled = 'F'`
- IV (invoices) and CS (cash sales) are **mutually exclusive** transaction types — no double-counting risk
- POS transactions are already included in the CS table; never add them separately
- CN (credit notes) are subtracted from revenue
- For MYR reporting, use `LocalNetTotal` instead of `NetTotal` (handles rare SGD records)

### 6.2 Date Handling

- All `DocDate` and `TransDate` values are stored in **UTC** in PostgreSQL
- Must add **8 hours** for conversion to **MYT (Malaysia Time, UTC+8)** before any date grouping, filtering, or display
- PostgreSQL equivalent: `DocDate AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur'`
- Date-based grouping (monthly, quarterly, yearly) must use the MYT-converted date

### 6.3 Cancelled Records

- All transaction tables include a `Cancelled` column
- **`Cancelled = 'F'`** means the record is active (NOT cancelled)
- **`Cancelled = 'T'`** means the record IS cancelled and should be excluded
- Some tables (e.g., DN) may have NULL values for Cancelled; treat as active: `(Cancelled = 'F' OR Cancelled IS NULL)`
- Always filter cancelled records before aggregation

### 6.4 Multi-Currency Handling

| Field | Currency | When to Use |
|---|---|---|
| NetTotal | Transaction currency | Only for per-transaction display in original currency |
| LocalNetTotal | MYR (home currency) | **All dashboard aggregations and comparisons** |
| CurrencyCode | — | Identifies transaction currency |
| CurrencyRate | — | Exchange rate at transaction time |

- The majority of transactions are in MYR
- Rare SGD (Singapore Dollar) transactions exist; `LocalNetTotal` automatically converts these to MYR
- For line-level reporting, use `LocalSubTotal` or `LocalSubTotalExTax` (the ex-tax variant is used for margin calculations)

### 6.5 Credit Scoring (Payment Dashboard)

The dashboard implements a **configurable 5-factor credit scoring model** (v2) that produces a composite score from 0 to 100 for each customer.

**Factors and Default Weights:**

| Factor | Weight | Description | Score Range |
|---|---|---|---|
| Credit Utilization | 35% | Outstanding / CreditLimit percentage | 0-100 (lower utilization = higher score) |
| Overdue Days | 25% | Oldest overdue invoice age | 100 (0 days) to 0 (120+ days) |
| Payment Consistency | 15% | Months with payment / Months with invoices | 100 (>=90%) to 25 (<50%) |
| Timeliness | 15% | Average days late across paid invoices (12-month window) | 100 (on time) to 0 (60+ days late) |
| Breach | 10% | Whether outstanding exceeds OverdueLimit | 100 (no breach) or 0 (breached) |

**Risk Tier Thresholds (from composite score):**

| Tier | Score Range |
|---|---|
| Low | >= 85 |
| Moderate | 65 – 84 |
| High | < 65 |

- Customers without a credit limit receive a configurable "neutral score" for the utilization and consistency factors (default: 0)
- The model is fully configurable via dashboard settings (weights, thresholds, neutral score)

### 6.6 Margin Calculations

**Supplier Margin (PIDTL-based):**
- COGS = Average purchase price per item (from PIDTL.LocalSubTotal / PIDTL.Qty) multiplied by sold quantity
- Revenue = Sum of sold item revenue from IVDTL.LocalSubTotalExTax + CSDTL.LocalSubTotalExTax
- This approach uses **actual purchase cost per supplier**, not AutoCount's blended weighted-average COGS
- Unsold inventory is excluded by using `MIN(purchased_qty, sold_qty)` logic

**Customer Margin (IVDTL-based):**
- Uses IVDTL.LocalTotalCost for invoice cost (AutoCount's weighted-average COGS)
- Uses CNDTL.UnitCost * CNDTL.Qty for credit note cost adjustments
- Net Revenue = IV revenue + DN revenue - CN revenue
- Net COGS = IV cost + DN cost - CN cost

### 6.7 Return/Credit Note Rules

- The Return dashboard filters ARCN records by `CNType = 'RETURN'` to focus on goods-returned credit notes
- Unresolved amount = `LocalNetTotal - KnockOffAmt - RefundAmt`
- A credit note is "reconciled" when `KnockOffAmt + RefundAmt >= LocalNetTotal`
- Credit note detail lines with `GoodsReturn = 'T'` indicate physical goods returned (vs. credit-only adjustments)

### 6.8 P&L Statement Structure

The P&L statement is built from PBalance records, grouped by AccType:

| AccType | Description | Sign Convention |
|---|---|---|
| SL | Sales | Credit as positive (CreditAsPositive = 'T') |
| SA | Sales Adjustments | Credit as positive |
| CO | Cost of Sales (COGS) | Debit as positive |
| OI | Other Income | Credit as positive |
| EP | Expenses | Debit as positive |

- **Gross Profit** = Net Sales (SL + SA) - COGS (CO)
- **Net Profit** = Gross Profit + Other Income (OI) - Expenses (EP)
- Period numbers in PBalance map to fiscal months; fiscal year boundaries come from FiscalYear table

### 6.9 Expenses Classification

GL accounts with `AccType = 'CO'` are classified as COGS. Accounts with `AccType = 'EP'` are classified as OPEX, further sub-grouped by account number pattern:

| Category | Account Pattern |
|---|---|
| Payroll | 900-S001, 900-S101 to S113, 900-W001/W101/W102, 900-D102 to D121, 900-S801 to S803 |
| Electricity & Water | 900-E001 |
| Packaging Materials | 900-P005 |
| Fuel | 900-D001, 900-P002, 900-P1xx |
| Rental | 900-R200 to R243 |
| Repair & Maintenance | 900-R300 to R304 |
| Vehicle & Equipment Upkeep | 900-U001, 900-U100 to U120, 900-U200 to U207 |
| Depreciation | 900-D003 |
| Insurance | 900-F002, F004, I001, I003, I004 |
| Finance Costs | 900-T003, H001, L001, B001, B002, B003 |
| Other OPEX | All remaining EP accounts |

Net cost for each account = `SUM(HomeDR) - SUM(HomeCR)`.

---

## 7. Dashboard-to-Table Mapping

| Dashboard Page | Primary Tables | Supporting/Lookup Tables |
|---|---|---|
| **Sales** | IV, CS, CN | Debtor, DebtorType, SalesAgent, CSDTL, CNDTL, IVDTL, ref_fruits, ref_fruit_aliases, ref_countries |
| **Payment** | ARInvoice, ARPayment, ARCN, ARPaymentKnockOff | Debtor, DebtorType, Terms |
| **Return** | ARCN, ARRefund, ARRefundDTL, ARRefundKnockOff | Debtor, CNDTL, Item, ARInvoice |
| **Supplier Margin** | PI, PIDTL, IV, IVDTL, CS, CSDTL | Creditor, CreditorType, Item, ItemGroup |
| **Customer Margin** | IV, IVDTL, CN, CNDTL, DN, DNDTL | Debtor, DebtorType, SalesAgent, Item, ItemGroup |
| **Expenses** | GLDTL, GLMast | AccType, FiscalYear |
| **P&L** | PBalance, GLMast, AccType, PLFormat, BSFormat | OBalance, FiscalYear, Project |

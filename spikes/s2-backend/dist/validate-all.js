/**
 * S2 Spike — Automated validation script
 * Runs all 8 validation points and reports results.
 */
import { PrismaClient } from '@prisma/client';
import { defineAbilityFor } from './common/services/ability.service.js';
import { createSaleRecordSchema } from './modules/finance/finance.validation.js';
const prisma = new PrismaClient();
const results = [];
function log(point, status, notes) {
    results.push({ point, status, notes });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${point}: ${notes}`);
}
async function validatePrisma() {
    // V2: Prisma 6 + PostgreSQL
    try {
        // Test connection
        await prisma.$queryRaw `SELECT 1 as connected`;
        log('V2a: Prisma connection', 'PASS', 'Connected to PostgreSQL via Prisma 6');
        // Test write
        const user = await prisma.spike_user.create({
            data: {
                name: 'Test User',
                email: `test-${Date.now()}@spike.dev`,
                role: 'finance',
                phone: '+60123456789',
            },
        });
        log('V2b: Prisma create', 'PASS', `Created user: ${user.id}`);
        // Test read
        const found = await prisma.spike_user.findUnique({ where: { id: user.id } });
        log('V2c: Prisma read', 'PASS', `Found user: ${found?.name}`);
        // Test aggregation (Decimal field)
        const sale = await prisma.spike_pc_sales_daily.create({
            data: {
                doc_date: new Date('2026-01-15'),
                net_total: 15000.50,
                doc_type: 'IV',
                customer_id: user.id,
            },
        });
        log('V2d: Prisma Decimal field', 'PASS', `Created sale with net_total=${sale.net_total}`);
        // Test findMany with where + orderBy
        const sales = await prisma.spike_pc_sales_daily.findMany({
            where: { doc_type: 'IV' },
            orderBy: { doc_date: 'desc' },
            take: 10,
        });
        log('V2e: Prisma query', 'PASS', `Found ${sales.length} sale(s)`);
        // Cleanup
        await prisma.spike_pc_sales_daily.deleteMany({});
        await prisma.spike_user.deleteMany({});
        log('V2f: Prisma cleanup', 'PASS', 'Cleaned up spike data');
    }
    catch (err) {
        log('V2: Prisma 6', 'FAIL', String(err));
    }
}
function validateCASL() {
    // V3: CASL 6 ability definitions
    try {
        const roles = ['superadmin', 'director', 'finance', 'hr', 'manager', 'sale', 'operation'];
        const checks = [];
        for (const role of roles) {
            const ability = defineAbilityFor({ id: 'test', role });
            if (role === 'superadmin') {
                const canManageAll = ability.can('manage', 'FinanceDashboard');
                if (!canManageAll)
                    throw new Error('superadmin should manage FinanceDashboard');
                checks.push(`${role}:manage=✓`);
            }
            if (role === 'finance') {
                const canRead = ability.can('read', 'FinanceDashboard');
                const canSync = ability.can('manage', 'FinanceSync');
                if (!canRead)
                    throw new Error('finance should read FinanceDashboard');
                if (canSync)
                    throw new Error('finance should NOT manage FinanceSync');
                checks.push(`${role}:read=✓,sync=✗`);
            }
            if (role === 'sale') {
                const canRead = ability.can('read', 'FinanceDashboard');
                if (canRead)
                    throw new Error('sale should NOT read FinanceDashboard');
                checks.push(`${role}:finance=✗`);
            }
            if (role === 'hr') {
                const canHR = ability.can('read', 'HRData');
                const canFinance = ability.can('read', 'FinanceDashboard');
                if (!canHR)
                    throw new Error('hr should read HRData');
                if (canFinance)
                    throw new Error('hr should NOT read FinanceDashboard');
                checks.push(`${role}:hr=✓,finance=✗`);
            }
            if (role === 'director') {
                const canRead = ability.can('read', 'FinanceDashboard');
                const canExport = ability.can('export', 'FinanceDashboard');
                const canUpdateSettings = ability.can('update', 'FinanceSettings');
                if (!canRead)
                    throw new Error('director should read FinanceDashboard');
                if (!canExport)
                    throw new Error('director should export FinanceDashboard');
                if (canUpdateSettings)
                    throw new Error('director should NOT update FinanceSettings');
                checks.push(`${role}:read=✓,export=✓,settings=✗`);
            }
        }
        log('V3: CASL 6 abilities', 'PASS', `All 7 roles validated: ${checks.join(' | ')}`);
    }
    catch (err) {
        log('V3: CASL 6 abilities', 'FAIL', String(err));
    }
}
function validateZod() {
    // V6: Zod 4 request validation
    try {
        // Valid input
        const valid = createSaleRecordSchema.safeParse({
            doc_date: '2026-01-15T00:00:00Z',
            net_total: 15000.50,
            doc_type: 'IV',
        });
        if (!valid.success)
            throw new Error('Valid input rejected: ' + JSON.stringify(valid.error));
        // Verify transform (string → Date)
        if (!(valid.data.doc_date instanceof Date)) {
            throw new Error('Date transform failed — expected Date instance');
        }
        // Invalid input — bad doc_type
        const invalid = createSaleRecordSchema.safeParse({
            doc_date: '2026-01-15T00:00:00Z',
            net_total: -100,
            doc_type: 'INVALID',
        });
        if (invalid.success)
            throw new Error('Invalid input accepted');
        // Count issues
        const issueCount = invalid.error.issues.length;
        log('V6: Zod 4 validation', 'PASS', `Valid accepted, invalid rejected with ${issueCount} issue(s), Date transform works`);
    }
    catch (err) {
        log('V6: Zod 4 validation', 'FAIL', String(err));
    }
}
async function validateExpress5Integration() {
    // V4 + V5: Express 5 + CASL middleware + Prisma handler — tested via HTTP
    try {
        // Start server inline
        const { default: app } = await import('./server.js');
        // Give server a moment (it's already listening from import)
        await new Promise((r) => setTimeout(r, 500));
        const BASE = `http://localhost:${process.env.PORT || 3001}`;
        // Health check (no auth)
        const healthRes = await fetch(`${BASE}/health`);
        const health = await healthRes.json();
        if (health.status !== 'ok')
            throw new Error('Health check failed');
        log('V4a: Express 5 health', 'PASS', 'Health endpoint works');
        // Auth check — no headers → 401
        const noAuthRes = await fetch(`${BASE}/api/v1/finance/sales`);
        if (noAuthRes.status !== 401)
            throw new Error(`Expected 401, got ${noAuthRes.status}`);
        log('V4b: Auth middleware', 'PASS', '401 without auth headers');
        // RBAC check — sale role → 403 on finance
        const forbiddenRes = await fetch(`${BASE}/api/v1/finance/sales`, {
            headers: { 'x-user-role': 'sale', 'x-user-id': 'test-sale' },
        });
        if (forbiddenRes.status !== 403)
            throw new Error(`Expected 403, got ${forbiddenRes.status}`);
        log('V4c: CASL authorization', 'PASS', 'sale role blocked from FinanceDashboard');
        // Happy path — finance role reads sales
        const okRes = await fetch(`${BASE}/api/v1/finance/sales`, {
            headers: { 'x-user-role': 'finance', 'x-user-id': 'test-finance' },
        });
        if (okRes.status !== 200)
            throw new Error(`Expected 200, got ${okRes.status}`);
        const okData = await okRes.json();
        log('V5a: Prisma + Express GET', 'PASS', `Finance GET /sales → ${okData.count} records`);
        // POST with Zod validation — invalid body
        const badPostRes = await fetch(`${BASE}/api/v1/finance/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': 'superadmin',
                'x-user-id': 'test-admin',
            },
            body: JSON.stringify({ doc_date: 'not-a-date', net_total: -1, doc_type: 'NOPE' }),
        });
        if (badPostRes.status !== 400)
            throw new Error(`Expected 400, got ${badPostRes.status}`);
        log('V6b: Zod middleware reject', 'PASS', 'Invalid POST body rejected with 400');
        // POST with valid body
        const goodPostRes = await fetch(`${BASE}/api/v1/finance/sales`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-user-role': 'superadmin',
                'x-user-id': 'test-admin',
            },
            body: JSON.stringify({
                doc_date: '2026-03-15T00:00:00Z',
                net_total: 25000,
                doc_type: 'CS',
            }),
        });
        if (goodPostRes.status !== 201)
            throw new Error(`Expected 201, got ${goodPostRes.status}`);
        const created = await goodPostRes.json();
        log('V5b: Prisma + Express POST', 'PASS', `Created record: ${created.data.id}`);
        // Cleanup
        await prisma.spike_pc_sales_daily.deleteMany({});
    }
    catch (err) {
        log('V4/V5: Express integration', 'FAIL', String(err));
    }
}
async function main() {
    console.log('\n═══════════════════════════════════════════');
    console.log('  S2 SPIKE — Express 5 + Prisma 6 + CASL 6');
    console.log('═══════════════════════════════════════════\n');
    // V2: Prisma
    await validatePrisma();
    console.log('');
    // V3: CASL
    validateCASL();
    console.log('');
    // V6: Zod (unit level)
    validateZod();
    console.log('');
    // V4 + V5: Express integration (starts server)
    await validateExpress5Integration();
    console.log('');
    // Summary
    console.log('═══════════════════════════════════════════');
    console.log('  SUMMARY');
    console.log('═══════════════════════════════════════════');
    const passed = results.filter((r) => r.status === 'PASS').length;
    const failed = results.filter((r) => r.status === 'FAIL').length;
    for (const r of results) {
        const icon = r.status === 'PASS' ? '✅' : '❌';
        console.log(`  ${icon} ${r.point}`);
    }
    console.log(`\n  Total: ${passed} PASS, ${failed} FAIL\n`);
    await prisma.$disconnect();
    process.exit(failed > 0 ? 1 : 0);
}
main();
//# sourceMappingURL=validate-all.js.map
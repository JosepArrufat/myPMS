import type { NewAuditLog, AuditLog } from '../../schema/audit';
import { auditLog } from '../../schema/audit';
import type { TestDb } from '../setup';

export const createTestAuditEntry = async (
  db: TestDb,
  overrides: Partial<NewAuditLog> = {},
  tx?: any
): Promise<AuditLog> => {
  const conn = tx ?? db;
  const timestamp = Date.now();

  const [entry] = await conn.insert(auditLog).values({
    tableName: 'test_table',
    recordId: `${timestamp}`,
    action: 'update' as const,
    newValues: { test: 'data' },
    ...overrides,
  }).returning();
  
  return entry;
};

import type { 
  Promotion, 
  NewPromotion 
} from '../../schema/promotions';
import { promotions } from '../../schema/promotions';
import type { TestDb } from '../setup';

export const createTestPromotion = async (
  db: TestDb,
  overrides: Partial<NewPromotion> = {},
  tx?: any
): Promise<Promotion> => {
  const conn = tx ?? db;
  const timestamp = Date.now();
  
  const [promotion] = await conn.insert(promotions).values({
    code: `PROMO${timestamp.toString().slice(-6)}`,
    name: `Test Promotion ${timestamp}`,
    discountType: 'percent',
    discountValue: '10.00',
    validFrom: '2026-02-10',
    validTo: '2026-05-10',
    isActive: true,
    ...overrides,
  }).returning();
  
  return promotion;
};

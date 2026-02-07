import type { 
  HousekeepingTask, 
  NewHousekeepingTask,
  MaintenanceRequest,
  NewMaintenanceRequest
} from '../../schema/housekeeping';
import { 
  housekeepingTasks,
  maintenanceRequests 
} from '../../schema/housekeeping';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestHousekeepingTask = async (
  db: TestDb,
  roomId: number,
  overrides: Partial<NewHousekeepingTask> = {},
  tx?: any
): Promise<HousekeepingTask> => {
  const conn = tx ?? db;
  
  const [task] = await conn.insert(housekeepingTasks).values({
    roomId,
    taskType: 'checkout_cleaning',
    status: 'pending',
    ...overrides,
  }).returning();
  
  return task;
};

export const createTestMaintenanceRequest = async (
  db: TestDb,
  roomId: number,
  overrides: Partial<NewMaintenanceRequest> = {},
  tx?: any
): Promise<MaintenanceRequest> => {
  const conn = tx ?? db;
  
  const [request] = await conn.insert(maintenanceRequests).values({
    roomId,
    description: 'Broken faucet',
    status: 'open',
    priority: 'normal',
    ...overrides,
  }).returning();
  
  return request;
};

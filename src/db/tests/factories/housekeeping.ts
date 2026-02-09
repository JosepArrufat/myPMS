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
import type { TestDb } from '../setup';

export const createTestHousekeepingTask = async (
  db: TestDb,
  userId: number,
  overrides: Partial<NewHousekeepingTask> = {},
  tx?: any
): Promise<HousekeepingTask> => {
  const conn = tx ?? db;
  
  let roomId = overrides.roomId;
  if (!roomId) {
    const { createTestRoom } = await import('./rooms');
    const room = await createTestRoom(db, {}, tx);
    roomId = room.id;
  }
  
  const [task] = await conn
    .insert(housekeepingTasks)
    .values({
      roomId,
      taskType: 'checkout_cleaning',
      status: 'pending',
      createdBy: userId,
      ...overrides,
    })
    .returning();
  
  return task;
};

export const createTestMaintenanceRequest = async (
  db: TestDb,
  userId: number,
  overrides: Partial<NewMaintenanceRequest> = {},
  tx?: any
): Promise<MaintenanceRequest> => {
  const conn = tx ?? db;
  
  let roomId = overrides.roomId;
  if (!roomId) {
    const { createTestRoom } = await import('./rooms');
    const room = await createTestRoom(db, {}, tx);
    roomId = room.id;
  }
  
  const [request] = await conn
    .insert(maintenanceRequests)
    .values({
      roomId,
      description: 'Broken faucet',
      status: 'open',
      priority: 'normal',
      createdBy: userId,
      ...overrides,
    })
    .returning();
  
  return request;
};

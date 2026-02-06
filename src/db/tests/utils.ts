import { guests } from '../schema/guests.js';
import { agencies } from '../schema/agencies.js';
import { ratePlans } from '../schema/rates.js';
import { roomTypes, rooms } from '../schema/rooms.js';
import { users } from '../schema/users.js';

type TestDb = ReturnType<typeof import('drizzle-orm/postgres-js').drizzle>;

export const createTestGuest = async (testDb:TestDb, overrides: any = {}) => {
  const [guest] = await testDb.insert(guests).values({
    firstName: 'John',
    lastName: 'Doe',
    email: `john.doe.${Date.now()}@example.com`,
    phone: '+1234567890',
    dateOfBirth: '1990-01-15',
    nationality: 'US',
    idNumber: 'AB123456',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    country: 'USA',
    postalCode: '12345',
    ...overrides,
  }).returning();
  return guest;
};

export const createTestAgency = async (testDb:TestDb, overrides = {}) => {
  const [agency] = await testDb.insert(agencies).values({
    name: `Test Travel Agency ${Date.now()}`,
    code: 'a10001',
    type: 'agency',
    contactPerson: 'Jane Smith',
    email: `agency.${Date.now()}@example.com`,
    phone: '+0987654321',
    addressLine1: '456 Agency Ave',
    stateProvince: 'BA',
    city: 'Agency City',
    country: 'USA',
    postalCode: '54321',
    commissionPercent: '10.00',
    vatNumber: 'B123456789',
  }).returning();
  return agency;
};

export const createTestRatePlan = async (testDb:TestDb, overrides = {}) => {
  const [ratePlan] = await testDb.insert(ratePlans).values({
  name: 'Standard Rate 125',
  code: 'STD125',
  description: 'Standard room rate at 125 dollars',
  requiresAdvanceBookingDays: 3,
  maxLengthOfStay: 7,
  cancellationPolicy: '72h before check in time',
  cancellationDeadlineHours: 72,
  cancellationFeePercent: '100.00',
  validFrom: '2026-02-10',
  validTo: '2026-05-10',
    ...overrides,
  }).returning();
  return ratePlan;
};

export const createTestRoomType = async (testDb:TestDb, overrides = {}) => {
  const timestamp = Date.now();
  const [roomType] = await testDb.insert(roomTypes).values({
    name: `Standard Room ${timestamp}`,
    code: `STD${timestamp}`,
    description: 'Standard room type',
    totalRooms: 25,
    basePrice: '100.00',
    maxOccupancy: 2,
    maxAdults: 2,
    maxChildren: 1,
    sizeSqm: '30.00',
    bedConfiguration: 'queen',
    viewType: 'city',
    amenities: ['wifi', 'tv', 'minibar'],
    isActive: true,
    ...overrides,
  }).returning();
  return roomType;
};

export const createTestRoom = async (testDb:TestDb, roomTypeId:number, overrides = {}) => {
  const [room] = await testDb.insert(rooms).values({
    roomTypeId,
    roomNumber: '100A',
    floor: 1,
    status: 'available',
    notes: null,
    ...overrides,
  }).returning();
  return room;
};

export const createTestUser = async (testDb:TestDb, overrides = {}) => {
  const [user] = await testDb.insert(users).values({
    email: `usertest@example.com`,
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    firstName: 'Test',
    lastName: 'User',
    isActive: true,
    ...overrides,
  }).returning();
  return user;
};

export const dateHelpers = {
  today: () => new Date().toISOString().split('T')[0],
  tomorrow: () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  },
  daysFromNow: (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  },
  daysAgo: (days:number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  },
};
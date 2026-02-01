import { pgTable, date, integer, decimal, timestamp, primaryKey, index, } from 'drizzle-orm/pg-core';
import { roomTypes } from './rooms';
export const dailyRevenue = pgTable('daily_revenue', {
    date: date('date').primaryKey(),
    totalReservations: integer('total_reservations').default(0),
    checkedIn: integer('checked_in').default(0),
    checkedOut: integer('checked_out').default(0),
    noShows: integer('no_shows').default(0),
    cancellations: integer('cancellations').default(0),
    roomRevenue: decimal('room_revenue', { precision: 12, scale: 2 }).default('0'),
    foodRevenue: decimal('food_revenue', { precision: 12, scale: 2 }).default('0'),
    beverageRevenue: decimal('beverage_revenue', { precision: 12, scale: 2 }).default('0'),
    breakfastRevenue: decimal('breakfast_revenue', { precision: 12, scale: 2 }).default('0'),
    barRevenue: decimal('bar_revenue', { precision: 12, scale: 2 }).default('0'),
    minibarRevenue: decimal('minibar_revenue', { precision: 12, scale: 2 }).default('0'),
    parkingRevenue: decimal('parking_revenue', { precision: 12, scale: 2 }).default('0'),
    eventHallRevenue: decimal('event_hall_revenue', { precision: 12, scale: 2 }).default('0'),
    spaRevenue: decimal('spa_revenue', { precision: 12, scale: 2 }).default('0'),
    laundryRevenue: decimal('laundry_revenue', { precision: 12, scale: 2 }).default('0'),
    telephoneRevenue: decimal('telephone_revenue', { precision: 12, scale: 2 }).default('0'),
    internetRevenue: decimal('internet_revenue', { precision: 12, scale: 2 }).default('0'),
    otherRevenue: decimal('other_revenue', { precision: 12, scale: 2 }).default('0'),
    totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }).default('0'),
    availableRooms: integer('available_rooms').default(0),
    occupiedRooms: integer('occupied_rooms').default(0),
    occupancyRate: decimal('occupancy_rate', { precision: 5, scale: 4 }).default('0'),
    averageDailyRate: decimal('average_daily_rate', { precision: 10, scale: 2 }).default('0'),
    revenuePerAvailableRoom: decimal('revenue_per_available_room', { precision: 10, scale: 2 }).default('0'),
    calculatedAt: timestamp('calculated_at').defaultNow(),
});
export const dailyRevenueDateIdx = index('idx_daily_revenue_date').on(dailyRevenue.date);
export const monthlyRevenue = pgTable('monthly_revenue', {
    month: date('month').primaryKey(),
    totalReservations: integer('total_reservations'),
    totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }),
    // Room revenue breakdown
    roomRevenue: decimal('room_revenue', { precision: 12, scale: 2 }),
    barRateRevenue: decimal('bar_rate_revenue', { precision: 12, scale: 2 }),
    corporateRateRevenue: decimal('corporate_rate_revenue', { precision: 12, scale: 2 }),
    groupRateRevenue: decimal('group_rate_revenue', { precision: 12, scale: 2 }),
    congressRateRevenue: decimal('congress_rate_revenue', { precision: 12, scale: 2 }),
    otherRateRevenue: decimal('other_rate_revenue', { precision: 12, scale: 2 }),
    // F&B revenue breakdown
    foodRevenue: decimal('food_revenue', { precision: 12, scale: 2 }),
    beverageRevenue: decimal('beverage_revenue', { precision: 12, scale: 2 }),
    breakfastRevenue: decimal('breakfast_revenue', { precision: 12, scale: 2 }),
    barRevenue: decimal('bar_revenue', { precision: 12, scale: 2 }),
    minibarRevenue: decimal('minibar_revenue', { precision: 12, scale: 2 }),
    // Other revenue streams
    parkingRevenue: decimal('parking_revenue', { precision: 12, scale: 2 }),
    eventHallRevenue: decimal('event_hall_revenue', { precision: 12, scale: 2 }),
    spaRevenue: decimal('spa_revenue', { precision: 12, scale: 2 }),
    laundryRevenue: decimal('laundry_revenue', { precision: 12, scale: 2 }),
    telephoneRevenue: decimal('telephone_revenue', { precision: 12, scale: 2 }),
    internetRevenue: decimal('internet_revenue', { precision: 12, scale: 2 }),
    otherRevenue: decimal('other_revenue', { precision: 12, scale: 2 }),
    // Performance metrics
    avgOccupancyRate: decimal('avg_occupancy_rate', { precision: 5, scale: 4 }),
    avgDailyRate: decimal('avg_daily_rate', { precision: 10, scale: 2 }),
    avgRevpar: decimal('avg_revpar', { precision: 10, scale: 2 }),
    calculatedAt: timestamp('calculated_at').defaultNow(),
});
export const monthlyRevenueMonthIdx = index('idx_monthly_revenue_month').on(monthlyRevenue.month);
export const yearlyRevenue = pgTable('yearly_revenue', {
    year: integer('year').primaryKey(),
    totalReservations: integer('total_reservations'),
    totalRevenue: decimal('total_revenue', { precision: 12, scale: 2 }),
    // Room revenue breakdown
    roomRevenue: decimal('room_revenue', { precision: 12, scale: 2 }),
    barRateRevenue: decimal('bar_rate_revenue', { precision: 12, scale: 2 }),
    corporateRateRevenue: decimal('corporate_rate_revenue', { precision: 12, scale: 2 }),
    groupRateRevenue: decimal('group_rate_revenue', { precision: 12, scale: 2 }),
    congressRateRevenue: decimal('congress_rate_revenue', { precision: 12, scale: 2 }),
    otherRateRevenue: decimal('other_rate_revenue', { precision: 12, scale: 2 }),
    // F&B revenue breakdown
    foodRevenue: decimal('food_revenue', { precision: 12, scale: 2 }),
    beverageRevenue: decimal('beverage_revenue', { precision: 12, scale: 2 }),
    breakfastRevenue: decimal('breakfast_revenue', { precision: 12, scale: 2 }),
    barRevenue: decimal('bar_revenue', { precision: 12, scale: 2 }),
    minibarRevenue: decimal('minibar_revenue', { precision: 12, scale: 2 }),
    // Other revenue streams
    parkingRevenue: decimal('parking_revenue', { precision: 12, scale: 2 }),
    eventHallRevenue: decimal('event_hall_revenue', { precision: 12, scale: 2 }),
    spaRevenue: decimal('spa_revenue', { precision: 12, scale: 2 }),
    laundryRevenue: decimal('laundry_revenue', { precision: 12, scale: 2 }),
    telephoneRevenue: decimal('telephone_revenue', { precision: 12, scale: 2 }),
    internetRevenue: decimal('internet_revenue', { precision: 12, scale: 2 }),
    otherRevenue: decimal('other_revenue', { precision: 12, scale: 2 }),
    // Performance metrics
    avgOccupancyRate: decimal('avg_occupancy_rate', { precision: 5, scale: 4 }),
    avgDailyRate: decimal('avg_daily_rate', { precision: 10, scale: 2 }),
    avgRevpar: decimal('avg_revpar', { precision: 10, scale: 2 }),
    calculatedAt: timestamp('calculated_at').defaultNow(),
});
export const yearlyRevenueYearIdx = index('idx_yearly_revenue_year').on(yearlyRevenue.year);
export const dailyRoomTypeRevenue = pgTable('daily_room_type_revenue', {
    date: date('date').notNull(),
    roomTypeId: integer('room_type_id').notNull().references(() => roomTypes.id),
    roomsSold: integer('rooms_sold').default(0),
    revenue: decimal('revenue', { precision: 10, scale: 2 }).default('0'),
    averageRate: decimal('average_rate', { precision: 10, scale: 2 }).default('0'),
    calculatedAt: timestamp('calculated_at').defaultNow(),
});
export const dailyRoomTypeRevenuePk = primaryKey({ columns: [dailyRoomTypeRevenue.date, dailyRoomTypeRevenue.roomTypeId] });
export const dailyRoomTypeRevenueDateIdx = index('idx_daily_room_type_date').on(dailyRoomTypeRevenue.date);
export const dailyRoomTypeRevenueRoomTypeIdx = index('idx_daily_room_type_room_type').on(dailyRoomTypeRevenue.roomTypeId);
export const dailyRateRevenue = pgTable('daily_rate_revenue', {
    date: date('date').notNull(),
    ratePlanId: integer('rate_plan_id').notNull(),
    roomsSold: integer('rooms_sold').default(0),
    roomRevenue: decimal('room_revenue', { precision: 10, scale: 2 }).default('0'),
    averageRate: decimal('average_rate', { precision: 10, scale: 2 }).default('0'),
    calculatedAt: timestamp('calculated_at').defaultNow(),
});
export const dailyRateRevenuePk = primaryKey({ columns: [dailyRateRevenue.date, dailyRateRevenue.ratePlanId] });
export const dailyRateRevenueDateIdx = index('idx_daily_rate_date').on(dailyRateRevenue.date);
export const dailyRateRevenueRatePlanIdx = index('idx_daily_rate_rate_plan').on(dailyRateRevenue.ratePlanId);

/**
 * Hotel PMS Seed Script
 *
 * Generates realistic data for a ~120-room boutique hotel:
 *  - 8 staff users (various roles)
 *  - 6 room types, 120 rooms
 *  - 3 rate plans + rate adjustments (derived pricing)
 *  - 90-day room inventory window
 *  - 80 guests
 *  - 2 agencies
 *  - 60 reservations across past/present/future dates
 *  - invoices, payments, invoice items
 *  - housekeeping tasks & maintenance requests
 *  - promotions & overbooking policies
 *
 * Usage:  npx tsx scripts/seed.ts
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import * as schema from '../src/db/schema/index.js'
import { hashPassword } from '../src/auth.js'
import 'dotenv/config'

const {
  users,
  permissions,
  rolePermissions,
  guests,
  roomTypes,
  rooms,
  ratePlans,
  roomTypeRates,
  roomTypeRateAdjustments,
  roomInventory,
  agencies,
  reservations,
  reservationRooms,
  reservationDailyRates,
  invoices,
  invoiceItems,
  payments,
  housekeepingTasks,
  maintenanceRequests,
  promotions,
  overbookingPolicies,
} = schema


const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const rand = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min
const money = (min: number, max: number) =>
  (Math.random() * (max - min) + min).toFixed(2)
const pad = (n: number) => String(n).padStart(2, '0')

function addDays(base: Date, days: number): string {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const today = new Date()
today.setHours(0, 0, 0, 0)
const todayStr = today.toISOString().slice(0, 10)

const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Ana', 'Carlos', 'Sophie', 'Mohammed', 'Yuki',
  'Hans', 'Ingrid', 'Pedro', 'Lucia', 'Chen', 'Fatima', 'Ivan', 'Elena',
  'Thomas', 'Emma', 'Luis', 'Olivia', 'Marco', 'Laura', 'David', 'Sara',
  'Antonio', 'Julia', 'André', 'Marta', 'Diego', 'Carla', 'Raj', 'Priya',
  'Omar', 'Leila', 'Klaus', 'Birgit', 'Ryo', 'Sakura', 'Nils', 'Freya',
]
const LAST_NAMES = [
  'Smith', 'García', 'Müller', 'Tanaka', 'Silva', 'Rossi', 'Kim', 'Petrov',
  'Jensen', 'Dupont', 'López', 'Novak', 'Ahmed', 'Chen', 'Williams', 'Brown',
  'Fernández', 'Schmidt', 'Andersen', 'Moreau', 'Kowalski', 'Santos', 'Lee',
  'Martínez', 'Johansson', 'Bianchi', 'Nakamura', 'Ali', 'Fischer', 'Berg',
]
const COUNTRIES = [
  'Spain', 'Germany', 'France', 'Italy', 'UK', 'USA', 'Japan', 'Brazil',
  'Portugal', 'Netherlands', 'Sweden', 'Norway', 'India', 'Mexico', 'Canada',
]
const CITIES = [
  'Madrid', 'Berlin', 'Paris', 'Rome', 'London', 'New York', 'Tokyo',
  'São Paulo', 'Lisbon', 'Amsterdam', 'Stockholm', 'Oslo', 'Mumbai',
]


async function seed() {
  const dbUrl = process.env.DB_URL
  if (!dbUrl) throw new Error('DB_URL env var required')

  const conn = postgres(dbUrl)
  const db = drizzle(conn, { schema })

  console.log('🌱 Seeding database...\n')

  // ── 0. Clean slate ──────────────────────────────────────────────
  console.log('  → Truncating existing data')
  await db.execute(sql`
    TRUNCATE TABLE
      payments,
      invoice_items,
      invoices,
      reservation_daily_rates,
      room_assignments,
      reservation_rooms,
      reservations,
      room_blocks,
      room_type_rates,
      room_type_rate_adjustments,
      room_inventory,
      housekeeping_tasks,
      maintenance_requests,
      rooms,
      room_types,
      rate_plans,
      guests,
      agencies,
      overbooking_policies,
      promotions,
      audit_log,
      role_permissions,
      permissions,
      users,
      daily_revenue,
      monthly_revenue,
      yearly_revenue
    RESTART IDENTITY CASCADE
  `)
  console.log('    ✓ All tables truncated')

  // ── 1. Users ────────────────────────────────────────────────────
  console.log('  → Users (hashing passwords...)')

  // Known plaintext passwords — use these to log in via Postman:
  //   admin@hotel.com        → admin123
  //   all other staff        → hotel123
  const adminHash = await hashPassword('admin123')
  const staffHash = await hashPassword('hotel123')

  const staffData: schema.NewUser[] = [
    { email: 'admin@hotel.com',       passwordHash: adminHash, firstName: 'System',  lastName: 'Admin',    role: 'admin' },
    { email: 'manager@hotel.com',     passwordHash: staffHash, firstName: 'Helena',  lastName: 'Torres',   role: 'manager' },
    { email: 'frontdesk1@hotel.com',  passwordHash: staffHash, firstName: 'Carlos',  lastName: 'Mendes',   role: 'front_desk' },
    { email: 'frontdesk2@hotel.com',  passwordHash: staffHash, firstName: 'Sophie',  lastName: 'Laurent',  role: 'front_desk' },
    { email: 'housekeeper1@hotel.com',passwordHash: staffHash, firstName: 'Rosa',    lastName: 'Martínez', role: 'housekeeping' },
    { email: 'housekeeper2@hotel.com',passwordHash: staffHash, firstName: 'João',    lastName: 'Almeida',  role: 'housekeeping' },
    { email: 'accountant@hotel.com',  passwordHash: staffHash, firstName: 'Marco',   lastName: 'Bianchi',  role: 'accountant' },
    { email: 'sales@hotel.com',       passwordHash: staffHash, firstName: 'Laura',   lastName: 'Svensson', role: 'sales' },
  ]
  const createdUsers = await db.insert(users).values(staffData).returning()
  const adminUser = createdUsers[0]
  const fdUser = createdUsers[2]
  const hkUsers = [createdUsers[4], createdUsers[5]]
  console.log(`    ✓ ${createdUsers.length} users`)

  // ── 2. Room Types ───────────────────────────────────────────────
  console.log('  → Room Types')
  const rtData: schema.NewRoomType[] = [
    { name: 'Standard Single', code: 'STD_SGL', basePrice: '95.00', maxOccupancy: 1, maxAdults: 1, maxChildren: 0, totalRooms: 20, sizeSqm: '18.00', bedConfiguration: '1 Single', viewType: 'city', amenities: ['wifi', 'tv', 'minibar', 'safe'], sortOrder: 1 },
    { name: 'Standard Double', code: 'STD_DBL', basePrice: '125.00', maxOccupancy: 2, maxAdults: 2, maxChildren: 1, totalRooms: 30, sizeSqm: '22.00', bedConfiguration: '1 Double', viewType: 'city', amenities: ['wifi', 'tv', 'minibar', 'safe', 'coffee_maker'], sortOrder: 2 },
    { name: 'Superior Double', code: 'SUP_DBL', basePrice: '165.00', maxOccupancy: 3, maxAdults: 2, maxChildren: 2, totalRooms: 25, sizeSqm: '28.00', bedConfiguration: '1 Queen', viewType: 'garden', amenities: ['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe'], sortOrder: 3 },
    { name: 'Deluxe Twin', code: 'DLX_TWN', basePrice: '195.00', maxOccupancy: 3, maxAdults: 2, maxChildren: 2, totalRooms: 20, sizeSqm: '32.00', bedConfiguration: '2 Single', viewType: 'pool', amenities: ['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe', 'balcony'], sortOrder: 4 },
    { name: 'Junior Suite', code: 'JR_STE', basePrice: '280.00', maxOccupancy: 3, maxAdults: 2, maxChildren: 2, totalRooms: 15, sizeSqm: '45.00', bedConfiguration: '1 King', viewType: 'sea', amenities: ['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe', 'balcony', 'jacuzzi'], sortOrder: 5 },
    { name: 'Presidential Suite', code: 'PRES', basePrice: '520.00', maxOccupancy: 4, maxAdults: 2, maxChildren: 2, totalRooms: 2, sizeSqm: '85.00', bedConfiguration: '1 Super King', viewType: 'panoramic', amenities: ['wifi', 'tv', 'minibar', 'safe', 'coffee_maker', 'bathrobe', 'balcony', 'jacuzzi', 'butler_service', 'living_room'], sortOrder: 6 },
  ]
  const createdRTs = await db.insert(roomTypes).values(rtData).returning()
  console.log(`    ✓ ${createdRTs.length} room types`)

  // ── 3. Rooms ────────────────────────────────────────────────────
  console.log('  → Rooms')
  const roomValues: schema.NewRoom[] = []
  let roomCounter = 0
  for (const rt of createdRTs) {
    const floor = createdRTs.indexOf(rt) + 1
    for (let j = 1; j <= rt.totalRooms; j++) {
      roomCounter++
      roomValues.push({
        roomNumber: `${floor}${pad(j)}`,
        roomTypeId: rt.id,
        floor,
        building: 'Main',
        status: 'available',
        cleanlinessStatus: 'clean',
        isAccessible: j === 1,
      })
    }
  }
  const createdRooms = await db.insert(rooms).values(roomValues).returning()
  console.log(`    ✓ ${createdRooms.length} rooms`)

  // ── 4. Rate Plans ───────────────────────────────────────────────
  console.log('  → Rate Plans')
  const rpData: schema.NewRatePlan[] = [
    { name: 'Best Available Rate', code: 'BAR', description: 'Standard flexible rate', isPublic: true, cancellationDeadlineHours: 24, includesBreakfast: true, isActive: true },
    { name: 'Corporate Rate', code: 'CORP', description: 'Negotiated corporate rate', isPublic: false, cancellationDeadlineHours: 48, includesBreakfast: true, isActive: true, requiresAdvanceBookingDays: 0 },
    { name: 'Non-Refundable', code: 'NR', description: 'Discounted non-refundable', isPublic: true, isNonRefundable: true, includesBreakfast: false, isActive: true },
  ]
  const createdRPs = await db.insert(ratePlans).values(rpData).returning()
  const barPlan = createdRPs[0]
  const corpPlan = createdRPs[1]
  const nrPlan = createdRPs[2]
  console.log(`    ✓ ${createdRPs.length} rate plans`)

  // ── 5. Room Type Rates (90-day window) ──────────────────────────
  console.log('  → Room Type Rates (BAR, 90 days)')
  const rateStart = addDays(today, -30)
  const rateEnd = addDays(today, 60)
  const rtrValues: schema.NewRoomTypeRate[] = []
  for (const rt of createdRTs) {
    rtrValues.push({ roomTypeId: rt.id, ratePlanId: barPlan.id, startDate: rateStart, endDate: rateEnd, price: String(rt.basePrice) })
    const corpPrice = (parseFloat(String(rt.basePrice)) * 0.85).toFixed(2)
    rtrValues.push({ roomTypeId: rt.id, ratePlanId: corpPlan.id, startDate: rateStart, endDate: rateEnd, price: corpPrice })
    const nrPrice = (parseFloat(String(rt.basePrice)) * 0.80).toFixed(2)
    rtrValues.push({ roomTypeId: rt.id, ratePlanId: nrPlan.id, startDate: rateStart, endDate: rateEnd, price: nrPrice })
  }
  await db.insert(roomTypeRates).values(rtrValues)
  console.log(`    ✓ ${rtrValues.length} room type rate rows`)

  // ── 6. Rate Adjustments (derived pricing) ───────────────────────
  console.log('  → Rate Adjustments')
  const stdDbl = createdRTs[1]
  const adjValues: schema.NewRoomTypeRateAdjustment[] = [
    { baseRoomTypeId: stdDbl.id, derivedRoomTypeId: createdRTs[0].id, adjustmentType: 'amount', adjustmentValue: '-30.00' },
    { baseRoomTypeId: stdDbl.id, derivedRoomTypeId: createdRTs[2].id, adjustmentType: 'percent', adjustmentValue: '32' },
    { baseRoomTypeId: stdDbl.id, derivedRoomTypeId: createdRTs[3].id, adjustmentType: 'percent', adjustmentValue: '56' },
    { baseRoomTypeId: stdDbl.id, derivedRoomTypeId: createdRTs[4].id, adjustmentType: 'amount', adjustmentValue: '155.00' },
    { baseRoomTypeId: stdDbl.id, derivedRoomTypeId: createdRTs[5].id, adjustmentType: 'amount', adjustmentValue: '395.00' },
  ]
  await db.insert(roomTypeRateAdjustments).values(adjValues)
  console.log(`    ✓ ${adjValues.length} rate adjustments`)

  // ── 7. Room Inventory (90-day window) ───────────────────────────
  console.log('  → Room Inventory (90 days)')
  const invValues: schema.NewRoomInventory[] = []
  for (let d = -30; d <= 60; d++) {
    const dateStr = addDays(today, d)
    for (const rt of createdRTs) {
      const soldRooms = d < 0 ? rand(0, rt.totalRooms) : rand(0, Math.floor(rt.totalRooms * 0.6))
      invValues.push({
        roomTypeId: rt.id,
        date: dateStr,
        capacity: rt.totalRooms,
        available: rt.totalRooms - soldRooms,
      })
    }
  }
  await db.insert(roomInventory).values(invValues)
  console.log(`    ✓ ${invValues.length} inventory rows`)

  // ── 8. Agencies ─────────────────────────────────────────────────
  console.log('  → Agencies')
  const agencyData: schema.NewAgency[] = [
    { name: 'Iberia Travel Group', code: 'IBER', type: 'agency', contactPerson: 'Miguel Ruiz', email: 'bookings@iberiatravel.com', phone: '+34 91 555 1234', commissionPercent: '12.00', city: 'Madrid', country: 'Spain' },
    { name: 'Nordic Corporate Travel', code: 'NCT', type: 'company', contactPerson: 'Erik Lindberg', email: 'reservations@nct.se', phone: '+46 8 555 9876', commissionPercent: '8.00', city: 'Stockholm', country: 'Sweden' },
  ]
  const createdAgencies = await db.insert(agencies).values(agencyData).returning()
  console.log(`    ✓ ${createdAgencies.length} agencies`)

  // ── 9. Guests ───────────────────────────────────────────────────
  console.log('  → Guests')
  const guestValues: schema.NewGuest[] = []
  for (let i = 0; i < 80; i++) {
    const fn = pick(FIRST_NAMES)
    const ln = pick(LAST_NAMES)
    guestValues.push({
      firstName: fn,
      lastName: ln,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@email.com`,
      phone: `+${rand(1, 99)} ${rand(100, 999)} ${rand(100, 999)} ${rand(1000, 9999)}`,
      nationality: pick(COUNTRIES),
      languagePreference: pick(['en', 'es', 'de', 'fr', 'pt']),
      idDocumentType: pick(['passport', 'national_id', 'drivers_license']),
      idDocumentNumber: `${String.fromCharCode(rand(65, 90))}${rand(1000000, 9999999)}`,
      city: pick(CITIES),
      country: pick(COUNTRIES),
      vipStatus: Math.random() < 0.1,
      marketingOptIn: Math.random() < 0.6,
    })
  }
  const createdGuests = await db.insert(guests).values(guestValues).returning()
  console.log(`    ✓ ${createdGuests.length} guests`)

  // ── 10. Reservations ────────────────────────────────────────────
  console.log('  → Reservations')

  const resStatuses: Array<typeof schema.reservationStatusEnum.enumValues[number]> = [
    'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show',
  ]
  const sources = ['direct', 'website', 'phone', 'agency', 'group']
  const paymentMethods: Array<typeof schema.paymentMethodEnum.enumValues[number]> = [
    'cash', 'credit_card', 'debit_card', 'bank_transfer',
  ]

  let resCount = 0
  let invoiceCount = 0
  let paymentCount = 0
  let itemCount = 0

  for (let i = 0; i < 60; i++) {
    const guest = pick(createdGuests)
    const rt = pick(createdRTs)
    const offsetStart = rand(-25, 45)
    const nights = rand(1, 7)
    const checkIn = addDays(today, offsetStart)
    const checkOut = addDays(today, offsetStart + nights)

    let status: typeof schema.reservationStatusEnum.enumValues[number]
    if (offsetStart + nights < 0) {
      status = pick(['checked_out', 'cancelled', 'no_show'])
    } else if (offsetStart <= 0 && offsetStart + nights > 0) {
      status = pick(['checked_in', 'confirmed'])
    } else {
      status = pick(['pending', 'confirmed'])
    }

    const ratePlan = pick(createdRPs)
    const baseRate = parseFloat(String(rt.basePrice))
    const dailyRate = ratePlan.id === corpPlan.id
      ? (baseRate * 0.85).toFixed(2)
      : ratePlan.id === nrPlan.id
        ? (baseRate * 0.80).toFixed(2)
        : baseRate.toFixed(2)

    const totalAmount = (parseFloat(dailyRate) * nights).toFixed(2)
    const isAgency = Math.random() < 0.2
    const agencyId = isAgency ? pick(createdAgencies).id : undefined

    const [res] = await db.insert(reservations).values({
      reservationNumber: `RES-${Date.now()}-${i}`,
      guestId: guest.id,
      guestNameSnapshot: `${guest.firstName} ${guest.lastName}`,
      guestEmailSnapshot: guest.email,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      adultsCount: rand(1, rt.maxAdults),
      childrenCount: rand(0, rt.maxChildren),
      status,
      source: pick(sources),
      agencyId,
      ratePlanId: ratePlan.id,
      totalAmount,
      currency: 'EUR',
      createdBy: fdUser.id,
      actualCheckInTime: status === 'checked_in' || status === 'checked_out'
        ? new Date(new Date(checkIn).getTime() + rand(14, 18) * 3600000)
        : undefined,
      actualCheckOutTime: status === 'checked_out'
        ? new Date(new Date(checkOut).getTime() + rand(8, 12) * 3600000)
        : undefined,
    }).returning()
    resCount++

    const room = createdRooms.find((r) => r.roomTypeId === rt.id)
    const [resRoom] = await db.insert(reservationRooms).values({
      reservationId: res.id,
      roomTypeId: rt.id,
      roomId: (status === 'checked_in' || status === 'checked_out') && room ? room.id : undefined,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      ratePlanId: ratePlan.id,
      createdBy: fdUser.id,
    }).returning()

    for (let n = 0; n < nights; n++) {
      await db.insert(reservationDailyRates).values({
        reservationRoomId: resRoom.id,
        date: addDays(today, offsetStart + n),
        rate: dailyRate,
        ratePlanId: ratePlan.id,
        createdBy: fdUser.id,
      })
    }

    if (status === 'checked_out' || status === 'checked_in' || (status === 'confirmed' && Math.random() < 0.5)) {
      const [inv] = await db.insert(invoices).values({
        invoiceNumber: `INV-${Date.now()}-${i}`,
        invoiceType: 'final',
        reservationId: res.id,
        guestId: guest.id,
        issueDate: checkIn,
        status: status === 'checked_out' ? 'paid' : 'issued',
        subtotal: totalAmount,
        taxAmount: (parseFloat(totalAmount) * 0.10).toFixed(2),
        totalAmount: (parseFloat(totalAmount) * 1.10).toFixed(2),
        paidAmount: status === 'checked_out' ? (parseFloat(totalAmount) * 1.10).toFixed(2) : '0.00',
        balance: status === 'checked_out' ? '0.00' : (parseFloat(totalAmount) * 1.10).toFixed(2),
        taxRate: '0.1000',
        currency: 'EUR',
        createdBy: fdUser.id,
      }).returning()
      invoiceCount++

      for (let n = 0; n < nights; n++) {
        await db.insert(invoiceItems).values({
          invoiceId: inv.id,
          itemType: 'room',
          description: `Room night - ${addDays(today, offsetStart + n)}`,
          dateOfService: addDays(today, offsetStart + n),
          quantity: '1',
          unitPrice: dailyRate,
          total: dailyRate,
          roomId: room?.id,
          createdBy: fdUser.id,
        })
        itemCount++
      }

      if (Math.random() < 0.4) {
        const extraType = pick(['food', 'minibar', 'spa', 'laundry', 'parking'] as const)
        const extraPrice = money(8, 60)
        await db.insert(invoiceItems).values({
          invoiceId: inv.id,
          itemType: extraType,
          description: `${extraType.charAt(0).toUpperCase() + extraType.slice(1)} charge`,
          quantity: '1',
          unitPrice: extraPrice,
          total: extraPrice,
          createdBy: fdUser.id,
        })
        itemCount++
      }

      if (status === 'checked_out') {
        await db.insert(payments).values({
          invoiceId: inv.id,
          amount: (parseFloat(totalAmount) * 1.10).toFixed(2),
          paymentMethod: pick(paymentMethods),
          transactionReference: `TXN-${rand(100000, 999999)}`,
          isRefund: false,
          currency: 'EUR',
          createdBy: fdUser.id,
        })
        paymentCount++
      }
    }
  }
  console.log(`    ✓ ${resCount} reservations, ${invoiceCount} invoices, ${itemCount} items, ${paymentCount} payments`)

  // ── 11. Housekeeping Tasks ──────────────────────────────────────
  console.log('  → Housekeeping Tasks')
  const hkTypes: Array<typeof schema.housekeepingTaskTypeEnum.enumValues[number]> = [
    'client_service', 'checkout_cleaning', 'deep_cleaning', 'turndown_service', 'linen_change',
  ]
  const hkStatuses: Array<typeof schema.housekeepingTaskStatusEnum.enumValues[number]> = [
    'pending', 'assigned', 'in_progress', 'completed',
  ]
  const hkValues: schema.NewHousekeepingTask[] = []
  for (let d = -5; d <= 2; d++) {
    const dateStr = addDays(today, d)
    const taskCount = rand(15, 30)
    for (let t = 0; t < taskCount; t++) {
      const rm = pick(createdRooms)
      const hkStatus = d < 0 ? 'completed' : pick(hkStatuses)
      hkValues.push({
        roomId: rm.id,
        taskDate: dateStr,
        taskType: pick(hkTypes),
        priority: rand(0, 3),
        status: hkStatus,
        assignedTo: pick(hkUsers).id,
        completedAt: hkStatus === 'completed' ? new Date() : undefined,
        createdBy: adminUser.id,
      })
    }
  }
  await db.insert(housekeepingTasks).values(hkValues)
  console.log(`    ✓ ${hkValues.length} housekeeping tasks`)

  // ── 12. Maintenance Requests ────────────────────────────────────
  console.log('  → Maintenance Requests')
  const maintCategories = ['plumbing', 'electrical', 'hvac', 'furniture', 'painting', 'appliance']
  const maintPriorities: Array<'low' | 'normal' | 'high' | 'urgent'> = ['low', 'normal', 'high', 'urgent']
  const maintStatuses: Array<'open' | 'in_progress' | 'completed'> = ['open', 'in_progress', 'completed']
  const maintValues: schema.NewMaintenanceRequest[] = []
  for (let i = 0; i < 20; i++) {
    const rm = pick(createdRooms)
    const s = pick(maintStatuses)
    maintValues.push({
      roomId: rm.id,
      category: pick(maintCategories),
      priority: pick(maintPriorities),
      description: `${pick(maintCategories)} issue in room ${rm.roomNumber}`,
      status: s,
      assignedTo: pick(hkUsers).id,
      completedAt: s === 'completed' ? new Date() : undefined,
      cost: s === 'completed' ? money(20, 500) : undefined,
      createdBy: adminUser.id,
    })
  }
  await db.insert(maintenanceRequests).values(maintValues)
  console.log(`    ✓ ${maintValues.length} maintenance requests`)

  // ── 13. Promotions ──────────────────────────────────────────────
  console.log('  → Promotions')
  const promoValues: schema.NewPromotion[] = [
    { code: 'SUMMER25', name: 'Summer Sale 25%', description: '25% off for summer bookings', discountType: 'percent', discountValue: '25.00', validFrom: addDays(today, 10), validTo: addDays(today, 90), minNights: 3, isActive: true },
    { code: 'WELCOME10', name: 'Welcome Discount', description: '€10 off first night', discountType: 'amount', discountValue: '10.00', validFrom: addDays(today, -30), validTo: addDays(today, 60), minNights: 1, isActive: true },
    { code: 'LONGSTAY', name: 'Long Stay 15%', description: '15% off for 7+ nights', discountType: 'percent', discountValue: '15.00', validFrom: addDays(today, -10), validTo: addDays(today, 120), minNights: 7, isActive: true },
  ]
  await db.insert(promotions).values(promoValues)
  console.log(`    ✓ ${promoValues.length} promotions`)

  // ── 14. Overbooking Policies ────────────────────────────────────
  console.log('  → Overbooking Policies')
  const obValues: schema.NewOverbookingPolicy[] = [
    { roomTypeId: null, startDate: addDays(today, 0), endDate: addDays(today, 30), overbookingPercent: 105 },
    { roomTypeId: createdRTs[1].id, startDate: addDays(today, 0), endDate: addDays(today, 14), overbookingPercent: 110 },
    { roomTypeId: createdRTs[4].id, startDate: addDays(today, 0), endDate: addDays(today, 30), overbookingPercent: 100 },
  ]
  await db.insert(overbookingPolicies).values(obValues)
  console.log(`    ✓ ${obValues.length} overbooking policies`)

  // ── done ────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n')
  console.log('  Seeded credentials (use these to POST /api/auth/login in Postman):')
  console.log('    admin@hotel.com         → admin123   (role: admin)')
  console.log('    manager@hotel.com       → hotel123   (role: manager)')
  console.log('    frontdesk1@hotel.com    → hotel123   (role: front_desk)')
  console.log('    frontdesk2@hotel.com    → hotel123   (role: front_desk)')
  console.log('    housekeeper1@hotel.com  → hotel123   (role: housekeeping)')
  console.log('    housekeeper2@hotel.com  → hotel123   (role: housekeeping)')
  console.log('    accountant@hotel.com    → hotel123   (role: accountant)')
  console.log('    sales@hotel.com         → hotel123   (role: sales)')
  console.log('')
  console.log('  Summary:')
  console.log(`    Users:          ${createdUsers.length}`)
  console.log(`    Room Types:     ${createdRTs.length}`)
  console.log(`    Rooms:          ${createdRooms.length} (total: 112)`)
  console.log(`    Rate Plans:     ${createdRPs.length}`)
  console.log(`    Inventory:      ${invValues.length} rows (90 days × 6 types)`)
  console.log(`    Guests:         ${createdGuests.length}`)
  console.log(`    Agencies:       ${createdAgencies.length}`)
  console.log(`    Reservations:   ${resCount}`)
  console.log(`    Invoices:       ${invoiceCount}`)
  console.log(`    Invoice Items:  ${itemCount}`)
  console.log(`    Payments:       ${paymentCount}`)
  console.log(`    HK Tasks:       ${hkValues.length}`)
  console.log(`    Maintenance:    ${maintValues.length}`)
  console.log(`    Promotions:     ${promoValues.length}`)
  console.log(`    OB Policies:    ${obValues.length}`)

  await conn.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})

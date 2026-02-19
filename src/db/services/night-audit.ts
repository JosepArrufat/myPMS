import {
  and,
  eq,
  isNull,
  sql,
} from 'drizzle-orm'

import type { PgTransaction } from 'drizzle-orm/pg-core'

import { db as defaultDb } from '../index.js'
import {
  reservations,
  reservationRooms,
  reservationDailyRates,
} from '../schema/reservations.js'
import {
  invoiceItemTypeEnum,
  invoices,
  invoiceItems,
} from '../schema/invoices.js'
import { trimExpiredPolicies } from '../queries/catalog/overbooking-policies.js'

type InvoiceItemType = (typeof invoiceItemTypeEnum.enumValues)[number]
type DbConnection = typeof defaultDb
type TxOrDb = DbConnection | PgTransaction<any, any, any>

const REVENUE_COLUMN_MAP: Record<InvoiceItemType, string> = {
  room: 'room_revenue',
  food: 'food_revenue',
  beverage: 'beverage_revenue',
  minibar: 'minibar_revenue',
  laundry: 'laundry_revenue',
  spa: 'spa_revenue',
  parking: 'parking_revenue',
  telephone: 'telephone_revenue',
  internet: 'internet_revenue',
  other: 'other_revenue',
}

export const postDailyRoomCharges = async (
  businessDate: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const checkedInReservations = await tx
      .select({
        id: reservations.id,
        guestId: reservations.guestId,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.status, 'checked_in'),
          sql`${reservations.checkInDate} <= ${businessDate}`,
          sql`${reservations.checkOutDate} > ${businessDate}`,
        ),
      )

    let chargesPosted = 0

    for (const reservation of checkedInReservations) {
      const resRooms = await tx
        .select({
          id: reservationRooms.id,
          roomId: reservationRooms.roomId,
        })
        .from(reservationRooms)
        .where(eq(reservationRooms.reservationId, reservation.id))

      let [invoice] = await tx
        .select()
        .from(invoices)
        .where(
          and(
            eq(invoices.reservationId, reservation.id),
            eq(invoices.invoiceType, 'final'),
            sql`${invoices.status} IN ('draft', 'issued')`,
          ),
        )
        .limit(1)

      if (!invoice) {
        const timestamp = Date.now()
        ;[invoice] = await tx
          .insert(invoices)
          .values({
            invoiceNumber: `INV-NA-${timestamp}`,
            invoiceType: 'final',
            reservationId: reservation.id,
            guestId: reservation.guestId,
            issueDate: businessDate,
            status: 'draft',
            createdBy: userId,
          })
          .returning()
      }

      for (const rr of resRooms) {
        const [dailyRate] = await tx
          .select({ rate: reservationDailyRates.rate })
          .from(reservationDailyRates)
          .where(
            and(
              eq(reservationDailyRates.reservationRoomId, rr.id),
              eq(reservationDailyRates.date, businessDate),
            ),
          )
          .limit(1)

        if (!dailyRate) continue

        const rate = parseFloat(String(dailyRate.rate))

        const roomIdCondition = rr.roomId != null
          ? eq(invoiceItems.roomId, rr.roomId)
          : isNull(invoiceItems.roomId)

        const [existing] = await tx
          .select({ id: invoiceItems.id })
          .from(invoiceItems)
          .where(
            and(
              eq(invoiceItems.invoiceId, invoice.id),
              eq(invoiceItems.itemType, 'room'),
              eq(invoiceItems.dateOfService, businessDate),
              roomIdCondition,
            ),
          )
          .limit(1)

        if (existing) continue 
        await tx.insert(invoiceItems).values({
          invoiceId: invoice.id,
          itemType: 'room',
          description: `Room night - ${businessDate}`,
          dateOfService: businessDate,
          quantity: '1',
          unitPrice: dailyRate.rate,
          total: rate.toFixed(2),
          roomId: rr.roomId,
          createdBy: userId,
        })

        chargesPosted++
      }

      const items = await tx
        .select({ total: invoiceItems.total })
        .from(invoiceItems)
        .where(eq(invoiceItems.invoiceId, invoice.id))

      const subtotal = items.reduce(
        (sum, i) => sum + parseFloat(String(i.total)),
        0,
      )

      await tx
        .update(invoices)
        .set({
          subtotal: subtotal.toFixed(2),
          totalAmount: subtotal.toFixed(2),
          balance: subtotal.toFixed(2),
          status: subtotal > 0 ? 'issued' : 'draft',
        })
        .where(eq(invoices.id, invoice.id))
    }

    return { businessDate, chargesPosted }
  })
}

export const generateDailyRevenueReport = async (
  businessDate: string,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [stats] = await tx.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE check_in_date = ${businessDate} AND status IN ('confirmed', 'checked_in')) AS arrivals,
        COUNT(*) FILTER (WHERE check_out_date = ${businessDate} AND status = 'checked_out') AS departures,
        COUNT(*) FILTER (WHERE status = 'checked_in' AND check_in_date <= ${businessDate} AND check_out_date > ${businessDate}) AS in_house,
        COUNT(*) FILTER (WHERE status = 'no_show' AND check_in_date = ${businessDate}) AS no_shows,
        COUNT(*) FILTER (WHERE status = 'cancelled' AND DATE(cancelled_at) = ${businessDate}::date) AS cancellations
      FROM reservations
    `)

    const revenueByType = await tx.execute(sql`
      SELECT
        ii.item_type,
        COALESCE(SUM(ii.total::numeric), 0) AS total
      FROM invoice_items ii
      WHERE ii.date_of_service = ${businessDate}
      GROUP BY ii.item_type
    `)

    const revenueMap: Record<string, string> = {}
    let totalRevenue = 0
    for (const row of revenueByType as any[]) {
      revenueMap[row.item_type] = parseFloat(row.total).toFixed(2)
      totalRevenue += parseFloat(row.total)
    }

    const [occupancy] = await tx.execute(sql`
      SELECT
        COUNT(*) AS total_rooms,
        COUNT(*) FILTER (WHERE status = 'occupied') AS occupied_rooms
      FROM rooms
    `)

    const totalRooms = parseInt(String((occupancy as any).total_rooms ?? 0))
    const occupiedRooms = parseInt(String((occupancy as any).occupied_rooms ?? 0))
    const occupancyRate = totalRooms > 0 ? occupiedRooms / totalRooms : 0
    const adr = occupiedRooms > 0 ? (parseFloat(revenueMap.room ?? '0') / occupiedRooms) : 0
    const revpar = totalRooms > 0 ? (parseFloat(revenueMap.room ?? '0') / totalRooms) : 0

    await tx.execute(sql`
      INSERT INTO daily_revenue (
        date, total_reservations, checked_in, checked_out, no_shows, cancellations,
        room_revenue, food_revenue, beverage_revenue, minibar_revenue,
        laundry_revenue, spa_revenue, parking_revenue, telephone_revenue,
        internet_revenue, other_revenue, total_revenue,
        available_rooms, occupied_rooms, occupancy_rate,
        average_daily_rate, revenue_per_available_room, calculated_at
      ) VALUES (
        ${businessDate},
        ${parseInt(String((stats as any).arrivals ?? 0))},
        ${parseInt(String((stats as any).arrivals ?? 0))},
        ${parseInt(String((stats as any).departures ?? 0))},
        ${parseInt(String((stats as any).no_shows ?? 0))},
        ${parseInt(String((stats as any).cancellations ?? 0))},
        ${parseFloat(revenueMap.room ?? '0')},
        ${parseFloat(revenueMap.food ?? '0')},
        ${parseFloat(revenueMap.beverage ?? '0')},
        ${parseFloat(revenueMap.minibar ?? '0')},
        ${parseFloat(revenueMap.laundry ?? '0')},
        ${parseFloat(revenueMap.spa ?? '0')},
        ${parseFloat(revenueMap.parking ?? '0')},
        ${parseFloat(revenueMap.telephone ?? '0')},
        ${parseFloat(revenueMap.internet ?? '0')},
        ${parseFloat(revenueMap.other ?? '0')},
        ${totalRevenue},
        ${totalRooms - occupiedRooms},
        ${occupiedRooms},
        ${occupancyRate},
        ${adr},
        ${revpar},
        NOW()
      )
      ON CONFLICT (date) DO UPDATE SET
        room_revenue = EXCLUDED.room_revenue,
        food_revenue = EXCLUDED.food_revenue,
        total_revenue = EXCLUDED.total_revenue,
        occupied_rooms = EXCLUDED.occupied_rooms,
        occupancy_rate = EXCLUDED.occupancy_rate,
        average_daily_rate = EXCLUDED.average_daily_rate,
        revenue_per_available_room = EXCLUDED.revenue_per_available_room,
        calculated_at = NOW()
    `)

    return {
      date: businessDate,
      arrivals: parseInt(String((stats as any).arrivals ?? 0)),
      departures: parseInt(String((stats as any).departures ?? 0)),
      inHouse: parseInt(String((stats as any).in_house ?? 0)),
      noShows: parseInt(String((stats as any).no_shows ?? 0)),
      cancellations: parseInt(String((stats as any).cancellations ?? 0)),
      revenueByType: revenueMap,
      totalRevenue: totalRevenue.toFixed(2),
      occupancy: {
        totalRooms,
        occupiedRooms,
        occupancyRate: occupancyRate.toFixed(4),
        adr: adr.toFixed(2),
        revpar: revpar.toFixed(2),
      },
    }
  })
}

export const flagDiscrepancies = async (
  businessDate: string,
  db: TxOrDb = defaultDb,
) => {
  const issues: Array<{
    type: string
    reservationId?: string
    roomId?: number
    detail: string
  }> = []
  const noInvoice = await db.execute(sql`
    SELECT r.id, r.reservation_number
    FROM reservations r
    WHERE r.status = 'checked_in'
      AND NOT EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.reservation_id = r.id AND i.invoice_type = 'final'
      )
  `)

  for (const row of noInvoice as any[]) {
    issues.push({
      type: 'no_invoice',
      reservationId: row.id,
      detail: `Checked-in reservation ${row.reservation_number} has no final invoice`,
    })
  }

  const unpaidCheckouts = await db.execute(sql`
    SELECT r.id, r.reservation_number, i.balance
    FROM reservations r
    JOIN invoices i ON i.reservation_id = r.id AND i.invoice_type = 'final'
    WHERE r.status = 'checked_out'
      AND i.balance::numeric > 0
  `)

  for (const row of unpaidCheckouts as any[]) {
    issues.push({
      type: 'unpaid_checkout',
      reservationId: row.id,
      detail: `Checked-out reservation ${row.reservation_number} has outstanding balance: ${row.balance}`,
    })
  }

  const orphanRooms = await db.execute(sql`
    SELECT rm.id, rm.room_number
    FROM rooms rm
    WHERE rm.status = 'occupied'
      AND NOT EXISTS (
        SELECT 1 FROM reservation_rooms rr
        JOIN reservations r ON r.id = rr.reservation_id
        WHERE rr.room_id = rm.id
          AND r.status = 'checked_in'
      )
  `)

  for (const row of orphanRooms as any[]) {
    issues.push({
      type: 'orphan_occupied',
      roomId: row.id,
      detail: `Room ${row.room_number} is occupied but has no checked-in reservation`,
    })
  }

  return issues
}

export const runNightAudit = async (
  businessDate: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  const charges = await postDailyRoomCharges(businessDate, userId, db)
  const report = await generateDailyRevenueReport(businessDate, db)
  const discrepancies = await flagDiscrepancies(businessDate, db)
  const overbookingTrim = await trimExpiredPolicies(businessDate, db as any)

  return {
    businessDate,
    charges,
    report,
    discrepancies,
    overbookingTrim,
  }
}

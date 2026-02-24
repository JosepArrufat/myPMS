import {
  and,
  eq,
  inArray,
  sql,
} from 'drizzle-orm'

import { db as defaultDb } from '../index.js'
import {
  reservations,
  reservationRooms,
  reservationDailyRates,
  roomBlocks,
} from '../schema/reservations.js'
import { roomTypes } from '../schema/rooms.js'
import {
  type TxOrDb,
  dateRange,
  validateAvailability,
  decrementInventory,
  incrementInventory,
} from '../utils.js'
import { assertNotPastDate } from '../guards.js'

export const createGroupReservation = async (
  input: {
    contactGuestId: string
    groupName: string
    checkInDate: string
    checkOutDate: string
    agencyId?: number
    source?: string
    specialRequests?: string
    overbookingPercent?: number
    confirmed?: boolean
    rooms: Array<{
      roomTypeId: number
      adultsCount?: number
      childrenCount?: number
      ratePlanId?: number
      dailyRate?: string
      blockId?: number
    }>
  },
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    // Guard: cannot create group reservation starting in the past
    await assertNotPastDate(input.checkInDate, tx, 'Group check-in date')

    const timestamp = Date.now()
    const nights = dateRange(input.checkInDate, input.checkOutDate)
    const maxOverbookPct = input.overbookingPercent
    const uniqueTypeIds = [...new Set(input.rooms.map((r) => r.roomTypeId))]
    const rtRows = await tx
      .select({ id: roomTypes.id, maxOccupancy: roomTypes.maxOccupancy, name: roomTypes.name })
      .from(roomTypes)
      .where(inArray(roomTypes.id, uniqueTypeIds))

    const occupancyByType = new Map(rtRows.map((r) => [r.id, r.maxOccupancy]))
    const nameByType = new Map(rtRows.map((r) => [r.id, r.name]))

    let totalAdults = 0
    let totalChildren = 0
    for (const roomSpec of input.rooms) {
      totalAdults += roomSpec.adultsCount
        ?? occupancyByType.get(roomSpec.roomTypeId)
        ?? 1
      totalChildren += roomSpec.childrenCount ?? 0
    }

    // If the request mixes block rooms with non-block rooms, warn before committing.
    // Pure block or pure inventory groups proceed without a confirmation step.
    const hasAnyBlock = input.rooms.some((r) => r.blockId)
    const nonBlockRooms = input.rooms.filter((r) => !r.blockId)
    const isMixed = hasAnyBlock && nonBlockRooms.length > 0

    if (isMixed && !input.confirmed) {
      const seen = new Set<string>()
      const warnings: Array<{
        roomTypeId: number
        roomTypeName: string
        dailyRate: string | undefined
        message: string
      }> = []
      for (const room of nonBlockRooms) {
        const key = `${room.roomTypeId}:${room.dailyRate ?? ''}`
        if (!seen.has(key)) {
          seen.add(key)
          const roomTypeName = nameByType.get(room.roomTypeId) ?? `Room Type ${room.roomTypeId}`
          warnings.push({
            roomTypeId: room.roomTypeId,
            roomTypeName,
            dailyRate: room.dailyRate,
            message: `Room type "${roomTypeName}"${room.dailyRate ? ` at rate ${room.dailyRate}` : ''} is not from the original group block and will be taken from general available inventory.`,
          })
        }
      }
      return { requiresConfirmation: true as const, warnings }
    }

    if (nonBlockRooms.length > 0) {
      await validateAvailability(
        nonBlockRooms.map((r) => ({ roomTypeId: r.roomTypeId, quantity: 1 })),
        input.checkInDate,
        input.checkOutDate,
        maxOverbookPct, // undefined → auto-lookup from overbooking_policies
        tx,
      )
    }

    const [reservation] = await tx
      .insert(reservations)
      .values({
        reservationNumber: `GRP${timestamp}`,
        guestId: input.contactGuestId,
        guestNameSnapshot: input.groupName,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        adultsCount: totalAdults,
        childrenCount: totalChildren,
        status: 'pending',
        source: input.source ?? 'group',
        agencyId: input.agencyId,
        specialRequests: input.specialRequests,
        createdBy: userId,
      })
      .returning()

    let totalAmount = 0
    const createdRooms = []

    for (const roomSpec of input.rooms) {
      const [resRoom] = await tx
        .insert(reservationRooms)
        .values({
          reservationId: reservation.id,
          roomTypeId: roomSpec.roomTypeId,
          blockId: roomSpec.blockId,
          checkInDate: input.checkInDate,
          checkOutDate: input.checkOutDate,
          ratePlanId: roomSpec.ratePlanId,
          createdBy: userId,
        })
        .returning()

      if (roomSpec.dailyRate) {
        for (const night of nights) {
          await tx.insert(reservationDailyRates).values({
            reservationRoomId: resRoom.id,
            date: night,
            rate: roomSpec.dailyRate,
            ratePlanId: roomSpec.ratePlanId,
            createdBy: userId,
          })
          totalAmount += parseFloat(roomSpec.dailyRate)
        }
      }

      if (!roomSpec.blockId) {
        await decrementInventory(
          roomSpec.roomTypeId,
          input.checkInDate,
          input.checkOutDate,
          1,
          tx,
        )
      }

      createdRooms.push(resRoom)
    }

    await tx
      .update(reservations)
      .set({ totalAmount: totalAmount.toFixed(2) })
      .where(eq(reservations.id, reservation.id))

    const [updated] = await tx
      .select()
      .from(reservations)
      .where(eq(reservations.id, reservation.id))
      .limit(1)

    return { reservation: updated, rooms: createdRooms }
  })
}

export const getGroupRoomingList = async (
  reservationId: string,
  db: TxOrDb = defaultDb,
) => {
  const resRooms = await db
    .select({
      id: reservationRooms.id,
      roomTypeId: reservationRooms.roomTypeId,
      roomId: reservationRooms.roomId,
      checkInDate: reservationRooms.checkInDate,
      checkOutDate: reservationRooms.checkOutDate,
      notes: reservationRooms.notes,
      roomTypeName: roomTypes.name,
      roomTypeCode: roomTypes.code,
    })
    .from(reservationRooms)
    .innerJoin(roomTypes, eq(reservationRooms.roomTypeId, roomTypes.id))
    .where(eq(reservationRooms.reservationId, reservationId))

  return resRooms
}

export const createGroupBlock = async (
  roomTypeId: number,
  startDate: string,
  endDate: string,
  quantity: number,
  reason: string,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  // Guard: cannot create group blocks starting in the past
  await assertNotPastDate(startDate, db, 'Block start date')

  return db.transaction(async (tx) => {
    const [block] = await tx
      .insert(roomBlocks)
      .values({
        roomTypeId,
        startDate,
        endDate,
        blockType: 'group_hold',
        quantity,
        reason,
        createdBy: userId,
      })
      .returning()

    await decrementInventory(roomTypeId, startDate, endDate, quantity, tx)

    return block
  })
}


export const getBlockPickup = async (
  blockId: number,
  db: TxOrDb = defaultDb,
) => {
  const [block] = await db
    .select()
    .from(roomBlocks)
    .where(eq(roomBlocks.id, blockId))
    .limit(1)

  if (!block) throw new Error('block not found')

  const [result] = await db.execute(sql`
    SELECT COUNT(*)::int AS pickup
    FROM reservation_rooms rr
    JOIN reservations r ON r.id = rr.reservation_id
    WHERE rr.block_id = ${block.id}
      AND r.status IN ('pending', 'confirmed', 'checked_in')
  `)

  return {
    block,
    pickedUp: (result as any).pickup ?? 0,
    total: block.quantity ?? 0,
    remaining: (block.quantity ?? 0) - ((result as any).pickup ?? 0),
  }
}

export const releaseGroupBlock = async (
  blockId: number,
  userId: number,
  db: TxOrDb = defaultDb,
) => {
  return db.transaction(async (tx) => {
    const [block] = await tx
      .select()
      .from(roomBlocks)
      .where(
        and(
          eq(roomBlocks.id, blockId),
          sql`${roomBlocks.releasedAt} IS NULL`,
        ),
      )
      .limit(1)

    if (!block) throw new Error('block not found or already released')

    const [pickupResult] = await tx.execute(sql`
      SELECT COUNT(*)::int AS pickup
      FROM reservation_rooms rr
      JOIN reservations r ON r.id = rr.reservation_id
      WHERE rr.block_id = ${block.id}
        AND r.status IN ('pending', 'confirmed', 'checked_in')
    `)
    const pickedUp = (pickupResult as any).pickup ?? 0
    const unreleased = (block.quantity ?? 0) - pickedUp

    if (unreleased > 0 && block.roomTypeId) {
      await incrementInventory(
        block.roomTypeId,
        block.startDate,
        block.endDate,
        unreleased,
        tx,
      )
    }
    const [released] = await tx
      .update(roomBlocks)
      .set({
        releasedAt: new Date(),
        releasedBy: userId,
      })
      .where(eq(roomBlocks.id, blockId))
      .returning()

    return { ...released, releasedSlots: unreleased, pickedUp }
  })
}

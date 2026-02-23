import { eq } from 'drizzle-orm'
import { db as defaultDb } from '../index.js'
import { systemConfig } from '../schema/system.js'

type DbConnection = typeof defaultDb

const BUSINESS_DATE_KEY = 'business_date'

export const getBusinessDate = async (db: DbConnection = defaultDb): Promise<string> => {
  const [row] = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, BUSINESS_DATE_KEY))
    .limit(1)

  if (row) return row.value

  const today = new Date().toISOString().slice(0, 10)
  await db
    .insert(systemConfig)
    .values({ key: BUSINESS_DATE_KEY, value: today })
    .onConflictDoNothing()
  return today
}

export const advanceBusinessDate = async (db: DbConnection = defaultDb): Promise<string> => {
  const current = await getBusinessDate(db)
  const next = new Date(current)
  next.setDate(next.getDate() + 1)
  const nextStr = next.toISOString().slice(0, 10)

  await db
    .insert(systemConfig)
    .values({ key: BUSINESS_DATE_KEY, value: nextStr })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: nextStr },
    })

  return nextStr
}

export const setBusinessDate = async (date: string, db: DbConnection = defaultDb): Promise<string> => {
  await db
    .insert(systemConfig)
    .values({ key: BUSINESS_DATE_KEY, value: date })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: date },
    })
  return date
}

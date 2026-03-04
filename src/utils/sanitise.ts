export const sanitiseEmail = (email: string | null | undefined): string | null | undefined => {
  if (!email) return email
  return email.trim().toLowerCase()
}

export const sanitisePhone = (phone: string | null | undefined): string | null | undefined => {
  if (!phone) return phone
  return phone.replace(/\s+/g, '').trim()
}

export const trimString = (val: string | null | undefined): string | null | undefined => {
  if (!val) return val
  return val.trim()
}

export const sanitiseGuestInput = <T extends Record<string, any>>(data: T): T => {
  const out: any = { ...data }
  if ('email' in out) out.email = sanitiseEmail(out.email)
  if ('phone' in out) out.phone = sanitisePhone(out.phone)
  if ('firstName' in out) out.firstName = trimString(out.firstName)
  if ('lastName' in out) out.lastName = trimString(out.lastName)
  return out
}

export const sanitiseAgencyInput = <T extends Record<string, any>>(data: T): T => {
  const out: any = { ...data }
  if ('name' in out) out.name = trimString(out.name)
  if ('email' in out) out.email = sanitiseEmail(out.email)
  if ('phone' in out) out.phone = sanitisePhone(out.phone)
  if ('code' in out) out.code = trimString(out.code)?.toUpperCase()
  return out
}

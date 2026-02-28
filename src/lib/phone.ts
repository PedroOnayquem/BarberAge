export function normalizePhone(value: string) {
  return value.replace(/\D/g, '').slice(0, 11)
}

export function formatPhone(value: string) {
  const digits = normalizePhone(value)

  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`

  const areaCode = digits.slice(0, 2)
  const rest = digits.slice(2)

  if (digits.length <= 6) {
    return `(${areaCode}) ${rest}`
  }

  if (digits.length <= 10) {
    return `(${areaCode}) ${rest.slice(0, 4)}-${rest.slice(4)}`
  }

  return `(${areaCode}) ${rest.slice(0, 5)}-${rest.slice(5)}`
}

export function countDigitsBeforeCaret(value: string, caretIndex: number) {
  const safeCaret = Math.max(0, caretIndex)
  return (value.slice(0, safeCaret).match(/\d/g) || []).length
}

export function caretIndexFromDigitCount(maskedValue: string, digitCount: number) {
  if (digitCount <= 0) return 0

  let seenDigits = 0

  for (let index = 0; index < maskedValue.length; index += 1) {
    if (/\d/.test(maskedValue[index])) {
      seenDigits += 1
      if (seenDigits === digitCount) {
        return index + 1
      }
    }
  }

  return maskedValue.length
}

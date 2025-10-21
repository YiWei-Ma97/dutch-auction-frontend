
export const fmtEth = (wei: bigint) => {
  const s = (Number(wei) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 6 })
  return s + ' ETH'
}
export const fmtToken = (n: bigint, decimals: number) => {
  const v = Number(n) / 10 ** decimals
  return v.toLocaleString(undefined, { maximumFractionDigits: 6 })
}
export const timeLeft = (secs: number) => {
  if (secs <= 0) return '0s'
  const m = Math.floor(secs / 60), s = secs % 60
  return `${m}m ${s}s`
}

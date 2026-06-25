/**
 * The package-type label/variant a client's badge should display.
 *
 * A client can be BILLED monthly but VISITED every 2 weeks (packageType:
 * 'monthly', recurrence: 'biweekly') — the inline package creator now makes
 * biweekly its own packageType, but /services-created and legacy clients keep
 * the split. Showing the raw packageType then reads "Monthly" while the cadence
 * line reads "Every 2 weeks" (contradictory, flagged in persona testing). When
 * the visit cadence is biweekly, show the biweekly badge so the two agree.
 */
export function badgePackageType(client) {
  if (client?.recurrence === 'biweekly') return 'biweekly'
  return client?.packageType || 'monthly'
}

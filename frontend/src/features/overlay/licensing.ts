// frontend/src/features/overlay/licensing.ts
//
// Centralized licensing check for overlay features.
//
// Phase 6 (D3 resolution): replaces the hardcoded `const isLicensed = false`
// that was scattered in ObsUrlTab and OverlayRenderer. When the billing
// system ships, update this single function to derive the licensed state
// from account/tenant data (e.g. Stripe subscription status).
//
// For now, free tier is the only tier — always returns false.

import type { CourtOverlayConfig } from './types'

/**
 * Derive the licensing state for overlay features.
 *
 * Currently always returns `false` (free tier). When billing ships,
 * this should check the account's subscription status or a dedicated
 * `is_licensed` field on the config/tenant object.
 *
 * @param _config - The overlay config (unused until billing wires it)
 * @returns `true` if the account is on a paid plan (watermark hidden)
 */
export function getIsLicensed(_config?: CourtOverlayConfig | null): boolean {
  // TODO: Wire from billing/subscription status when payment system ships.
  // e.g. return config?.is_licensed ?? false
  return false
}

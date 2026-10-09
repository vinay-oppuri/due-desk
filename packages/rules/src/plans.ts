export type PlanTier = 'free' | 'standard' | 'pro';

export interface PlanLimits {
  tier: PlanTier;
  name: string;
  maxBusinesses: number;
  documentVaultEnabled: boolean;
  maxDocumentVaultBytes: number;
  maxTeamMembers: number;
  channels: string[];
  priceMonthlyInr: number;
  priceAnnualInr: number;
}

export const PLAN_CONFIGS: Record<PlanTier, PlanLimits> = {
  free: {
    tier: 'free',
    name: 'Free Starter',
    maxBusinesses: 1,
    documentVaultEnabled: false,
    maxDocumentVaultBytes: 0,
    maxTeamMembers: 1,
    channels: ['email', 'ics'],
    priceMonthlyInr: 0,
    priceAnnualInr: 0,
  },
  standard: {
    tier: 'standard',
    name: 'Standard Business',
    maxBusinesses: 5,
    documentVaultEnabled: true,
    maxDocumentVaultBytes: 100 * 1024 * 1024, // 100MB
    maxTeamMembers: 3,
    channels: ['email', 'ics'],
    priceMonthlyInr: 499,
    priceAnnualInr: 4999,
  },
  pro: {
    tier: 'pro',
    name: 'Pro Multi-Business & CA',
    maxBusinesses: Infinity,
    documentVaultEnabled: true,
    maxDocumentVaultBytes: 1024 * 1024 * 1024, // 1GB
    maxTeamMembers: Infinity,
    channels: ['email', 'ics', 'whatsapp', 'sms'],
    priceMonthlyInr: 1499,
    priceAnnualInr: 14999,
  },
};

export function getPlanConfig(plan: string | null | undefined): PlanLimits {
  const normalized = (plan?.toLowerCase() as PlanTier) || 'free';
  return PLAN_CONFIGS[normalized] ?? PLAN_CONFIGS.free;
}

export function canAddBusiness(plan: string | null | undefined, currentCount: number): boolean {
  const config = getPlanConfig(plan);
  return currentCount < config.maxBusinesses;
}

export function canUseDocumentVault(plan: string | null | undefined): boolean {
  const config = getPlanConfig(plan);
  return config.documentVaultEnabled;
}

export function canAddTeamMember(plan: string | null | undefined, currentCount: number): boolean {
  const config = getPlanConfig(plan);
  return currentCount < config.maxTeamMembers;
}

/**
 * Checks if a subscription is in an active usable state or valid grace period.
 * Gives a 7-day grace period after failed renewal so statutory reminders are not cut off.
 */
export function isSubscriptionUsable(
  status: string | null | undefined,
  currentPeriodEnd?: Date | string | null,
): boolean {
  if (!status || status === 'active') return true;
  if (status === 'grace_period' || status === 'past_due') {
    if (!currentPeriodEnd) return true;
    const end = new Date(currentPeriodEnd);
    const graceCutoff = new Date(end.getTime() + 7 * 24 * 3600 * 1000); // 7 days grace
    return new Date() <= graceCutoff;
  }
  return false;
}

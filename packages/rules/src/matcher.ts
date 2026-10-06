import type {
  BusinessProfile,
  ComplianceRule,
  RuleCondition,
} from "./types.js";

/**
 * Resolves a nested field path like "registrations.gst" from an object.
 */
function getFieldValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  return path
    .split(".")
    .reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
}

/**
 * Evaluates whether a single condition matches the given profile.
 */
function evaluateCondition(
  profile: BusinessProfile,
  condition: RuleCondition,
): boolean {
  const actualValue = getFieldValue(profile, condition.field);
  const expectedValue = condition.value;

  switch (condition.operator) {
    case "equals": {
      // Handle boolean string comparisons smoothly (e.g. "true" vs true)
      if (
        typeof actualValue === "boolean" &&
        typeof expectedValue === "string"
      ) {
        return String(actualValue) === expectedValue.toLowerCase();
      }
      return actualValue === expectedValue;
    }
    case "not_equals": {
      if (
        typeof actualValue === "boolean" &&
        typeof expectedValue === "string"
      ) {
        return String(actualValue) !== expectedValue.toLowerCase();
      }
      return actualValue !== expectedValue;
    }
    case "in": {
      if (Array.isArray(expectedValue)) {
        return expectedValue.includes(actualValue);
      }
      return false;
    }
    case "not_in": {
      if (Array.isArray(expectedValue)) {
        return !expectedValue.includes(actualValue);
      }
      return true;
    }
    case "exists": {
      return (
        actualValue !== undefined &&
        actualValue !== null &&
        actualValue !== false
      );
    }
    default:
      return false;
  }
}

/**
 * Evaluates whether an unconfigured rule with standard form code defaults matches the profile.
 * Provides sensible matching when explicit rule_conditions are not supplied.
 */
function matchesDefaultRuleProfile(
  profile: BusinessProfile,
  rule: ComplianceRule,
): boolean {
  const code = rule.formCode.toUpperCase();

  // GST
  if (code.startsWith("GSTR-1-QRMP") || code.startsWith("GSTR-3B-QRMP")) {
    return !!profile.registrations?.gst && !!profile.registrations?.qrmp;
  }
  if (
    code.startsWith("GSTR-1") ||
    code.startsWith("GSTR-3B") ||
    code.startsWith("GSTR-9")
  ) {
    if (!profile.registrations?.gst) return false;
    if (
      profile.registrations?.qrmp &&
      (code.startsWith("GSTR-1") || code.startsWith("GSTR-3B"))
    ) {
      // If QRMP is enabled, normal monthly GSTR-1 and GSTR-3B don't apply
      return false;
    }
    return true;
  }

  // TDS
  if (
    code.includes("24Q") ||
    code.includes("26Q") ||
    code.includes("ITNS-281")
  ) {
    // If explicitly registered for TDS or has employee salary TDS
    return (
      profile.registrations?.tds ??
      (profile.hasEmployees ||
        profile.businessType === "pvt_ltd" ||
        profile.businessType === "llp")
    );
  }

  // Payroll
  if (code.startsWith("EPF")) {
    return profile.registrations?.pf ?? profile.hasEmployees;
  }
  if (code.startsWith("ESIC")) {
    return profile.registrations?.esi ?? profile.hasEmployees;
  }

  // Professional Tax state checks
  if (code.includes("PT-")) {
    if (profile.registrations?.pt === false) return false;
    if (code.endsWith("-KA")) return profile.state === "KA";
    if (code.endsWith("-MH")) return profile.state === "MH";
    if (code.endsWith("-TS")) return profile.state === "TS";
    if (code.endsWith("-TN")) return profile.state === "TN";
    if (code.endsWith("-WB")) return profile.state === "WB";
    return false;
  }

  // ROC (Companies & LLPs only)
  if (
    code.startsWith("AOC-") ||
    code.startsWith("MGT-") ||
    code.startsWith("DIR-") ||
    code.startsWith("ADT-")
  ) {
    return profile.businessType === "pvt_ltd" || profile.businessType === "llp";
  }

  // Income Tax (Advance Tax applies to businesses by default)
  if (code.startsWith("ADVANCE-TAX")) {
    return true;
  }

  return true;
}

/**
 * Pure function: matches business profile against compliance rules.
 */
export function matchRules(
  profile: BusinessProfile,
  rules: ComplianceRule[],
  conditions: RuleCondition[] = [],
): ComplianceRule[] {
  const conditionsByRuleId = new Map<string, RuleCondition[]>();
  for (const c of conditions) {
    const list = conditionsByRuleId.get(c.ruleId) ?? [];
    list.push(c);
    conditionsByRuleId.set(c.ruleId, list);
  }

  return rules.filter((rule) => {
    const ruleConditions = conditionsByRuleId.get(rule.id);

    // If explicit rule conditions are configured, ALL of them must pass
    if (ruleConditions && ruleConditions.length > 0) {
      return ruleConditions.every((cond) => evaluateCondition(profile, cond));
    }

    // Otherwise fallback to default statutory applicability
    return matchesDefaultRuleProfile(profile, rule);
  });
}

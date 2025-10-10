/**
 * Helper functions for TemplateAuditLogger
 */

import { createHmac } from 'node:crypto';
import type { AuditEntry, AuditLogQuery } from './types';

/**
 * Calculate entry integrity hash
 */
export function calculateIntegrity(
  entry: AuditEntry,
  secretKey: Buffer
): string {
  const data = JSON.stringify({
    timestamp: entry.timestamp,
    type: entry.type,
    severity: entry.severity,
    templateId: entry.templateId,
    templateVersion: entry.templateVersion,
    user: entry.user,
    pid: entry.pid,
    details: entry.details,
  });

  const hmac = createHmac('sha256', secretKey);
  hmac.update(data);
  return hmac.digest('hex');
}

/**
 * Verify entry integrity
 */
export function verifyEntry(
  entry: AuditEntry,
  secretKey: Buffer
): { valid: boolean; entry: AuditEntry } {
  const expected = calculateIntegrity(entry, secretKey);
  const valid = entry.integrity === expected;
  return { valid, entry };
}

/**
 * Generate secret key
 */
export function generateSecretKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('hex');
}

/**
 * Filter entries by time range
 */
export function filterByTime(
  entries: AuditEntry[],
  options: AuditLogQuery
): AuditEntry[] {
  let filtered = entries;
  if (options.startTime !== undefined) {
    const start = options.startTime.toISOString();
    filtered = filtered.filter((e) => e.timestamp >= start);
  }
  if (options.endTime !== undefined) {
    const end = options.endTime.toISOString();
    filtered = filtered.filter((e) => e.timestamp <= end);
  }
  return filtered;
}

/**
 * Filter entries by template ID
 */
export function filterByTemplate(
  entries: AuditEntry[],
  options: AuditLogQuery
): AuditEntry[] {
  if (options.templateId === undefined || options.templateId === '') {
    return entries;
  }
  return entries.filter((e) => e.templateId === options.templateId);
}

/**
 * Filter entries by event type
 */
export function filterByEventType(
  entries: AuditEntry[],
  options: AuditLogQuery
): AuditEntry[] {
  return options.eventType === undefined
    ? entries
    : entries.filter((e) => e.type === options.eventType);
}

/**
 * Filter entries by severity
 */
export function filterBySeverity(
  entries: AuditEntry[],
  options: AuditLogQuery
): AuditEntry[] {
  return options.severity === undefined
    ? entries
    : entries.filter((e) => e.severity === options.severity);
}

/**
 * Apply result limit
 */
export function applyLimit(
  entries: AuditEntry[],
  options: AuditLogQuery
): AuditEntry[] {
  return options.limit === undefined || options.limit === 0
    ? entries
    : entries.slice(-options.limit);
}

/**
 * Group entries by field
 */
export function groupBy(
  entries: AuditEntry[],
  field: 'type' | 'severity'
): Record<string, number> {
  const groups: Record<string, number> = {};
  for (const entry of entries) {
    const key = field === 'type' ? entry.type : entry.severity;
    groups[key] = (groups[key] ?? 0) + 1;
  }
  return groups;
}

/**
 * Get oldest entry timestamp
 */
export function getOldestEntry(entries: AuditEntry[]): string | null {
  return entries.length === 0 ? null : entries[0].timestamp;
}

/**
 * Get newest entry timestamp
 */
export function getNewestEntry(entries: AuditEntry[]): string | null {
  return entries.length === 0 ? null : entries[entries.length - 1].timestamp;
}

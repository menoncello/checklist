/**
 * File management for security audit logs
 * Handles file rotation, persistence, and reading
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { SecurityEvent } from './SecurityAudit';
import { STATE_DIR } from './constants';

const logger = createLogger('checklist:security-audit-file-manager');

export class SecurityAuditFileManager {
  private auditFilePath: string;
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_ROTATION_COUNT = 5;

  constructor(
    auditFilePath: string = path.join(STATE_DIR, 'security-audit.log')
  ) {
    this.auditFilePath = auditFilePath;
  }

  async ensureAuditFile(): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.auditFilePath), { recursive: true });

      // Check if audit file exists, create if not
      try {
        await fs.access(this.auditFilePath);
      } catch {
        // File doesn't exist, create it
        await fs.writeFile(this.auditFilePath, '', 'utf8');
        logger.info({ msg: 'Created security audit file' });
      }

      // Check file size and rotate if needed
      await this.checkAndRotateIfNeeded();
    } catch (error) {
      logger.error({ msg: 'Failed to ensure audit file', error });
      throw new Error('Failed to initialize audit file system');
    }
  }

  async writeEvents(events: SecurityEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const logEntries =
        events.map((event) => JSON.stringify(event)).join('\n') + '\n';
      await fs.appendFile(this.auditFilePath, logEntries, 'utf8');
    } catch (error) {
      logger.error({
        msg: 'Failed to write audit events',
        error,
        count: events.length,
      });
      throw error;
    }
  }

  async readLogs(since?: Date): Promise<SecurityEvent[]> {
    try {
      const content = await fs.readFile(this.auditFilePath, 'utf8');
      const lines = content
        .trim()
        .split('\n')
        .filter((line) => line.length > 0);

      const logs = lines
        .map((line) => this.parseLogLine(line, since))
        .filter((log) => log !== null) as SecurityEvent[];

      return logs;
    } catch (error) {
      logger.error({ msg: 'Failed to read audit logs', error });
      return [];
    }
  }

  private parseLogLine(line: string, since?: Date): SecurityEvent | null {
    try {
      const log = JSON.parse(line) as SecurityEvent;

      if (since !== undefined) {
        const logTime = new Date(log.timestamp);
        if (logTime < since) {
          return null;
        }
      }

      return log;
    } catch (_error) {
      logger.warn({ msg: 'Failed to parse audit log line', line });
      return null;
    }
  }

  private async checkAndRotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.auditFilePath);
      if (stats.size > SecurityAuditFileManager.MAX_FILE_SIZE) {
        await this.rotateAuditFile();
      }
    } catch (error) {
      // File may not exist, which is fine
      logger.debug({ msg: 'Could not check file size for rotation', error });
    }
  }

  private async rotateAuditFile(): Promise<void> {
    try {
      // Rotate existing files
      for (
        let i = SecurityAuditFileManager.MAX_ROTATION_COUNT - 1;
        i >= 1;
        i--
      ) {
        const oldFile = `${this.auditFilePath}.${i}`;
        const newFile = `${this.auditFilePath}.${i + 1}`;

        await this.rotateFile(oldFile, newFile, i);
      }

      // Move current file to .1
      await fs.rename(this.auditFilePath, `${this.auditFilePath}.1`);

      // Create new empty file
      await fs.writeFile(this.auditFilePath, '', 'utf8');

      logger.info({ msg: 'Security audit file rotated' });
    } catch (error) {
      logger.error({ msg: 'Failed to rotate audit file', error });
      throw error;
    }
  }

  private async rotateFile(
    oldFile: string,
    newFile: string,
    index: number
  ): Promise<void> {
    try {
      await fs.access(oldFile);
      if (index === SecurityAuditFileManager.MAX_ROTATION_COUNT - 1) {
        await fs.unlink(oldFile);
      } else {
        await fs.rename(oldFile, newFile);
      }
    } catch {
      // File doesn't exist, continue
    }
  }
}

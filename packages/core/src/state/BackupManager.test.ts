import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';
import { BackupManager } from './BackupManager';
import { ChecklistState, BackupManifest } from './types';
import { RecoveryError, BackupError } from './errors';

describe('BackupManager', () => {
  const testBackupDir = '.test-backups';
  let backupManager: BackupManager;
  let testState: ChecklistState;

  beforeEach(() => {
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true, force: true });
    }
    mkdirSync(testBackupDir, { recursive: true });

    backupManager = new BackupManager(testBackupDir);
    testState = {
      schemaVersion: '1.0.0',
      checksum: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      activeInstance: {
        id: '550e8400-e29b-41d4-a716-446655440000',
        templateId: 'template',
        templateVersion: '1.0.0',
        projectPath: '/test',
        status: 'active',
        startedAt: new Date().toISOString(),
        lastModifiedAt: new Date().toISOString(),
      },
      completedSteps: [],
      recovery: { dataLoss: false },
      conflicts: {},
    };
  });

  afterEach(() => {
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true, force: true });
    }
  });

  describe('Manifest Management', () => {
    it('should initialize manifest file', async () => {
      await backupManager.initializeManifest();
      
      const manifestPath = join(testBackupDir, 'manifest.yaml');
      expect(existsSync(manifestPath)).toBe(true);
      
      const content = await Bun.file(manifestPath).text();
      const manifest = yaml.load(content) as BackupManifest;
      
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.backups).toEqual([]);
      expect(manifest.rotationPolicy.maxCount).toBe(3);
    });

    it('should not overwrite existing manifest', async () => {
      await backupManager.initializeManifest();
      await backupManager.createBackup(testState);
      
      await backupManager.initializeManifest();
      
      const backups = await backupManager.listBackups();
      expect(backups.length).toBeGreaterThan(0);
    });
  });

  describe('Backup Creation', () => {
    it('should create backup successfully', async () => {
      await backupManager.initializeManifest();
      const backupPath = await backupManager.createBackup(testState);
      
      expect(existsSync(backupPath)).toBe(true);
      
      const content = await Bun.file(backupPath).text();
      const backedUpState = yaml.load(content) as ChecklistState;
      
      expect(backedUpState.schemaVersion).toBe(testState.schemaVersion);
      expect(backedUpState.activeInstance?.id).toBe(testState.activeInstance?.id);
    });

    it('should update manifest after backup', async () => {
      await backupManager.initializeManifest();
      await backupManager.createBackup(testState);
      
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1);
      expect(backups[0].schemaVersion).toBe(testState.schemaVersion);
      expect(backups[0].checksum).toBe(testState.checksum);
    });

    it('should handle backup errors gracefully', async () => {
      const invalidBackupManager = new BackupManager('/root/invalid-path');
      
      await expect(
        invalidBackupManager.createBackup(testState)
      ).rejects.toThrow(BackupError);
    });
  });

  describe('Backup Rotation', () => {
    it('should rotate backups when limit exceeded', async () => {
      await backupManager.initializeManifest();
      
      for (let i = 0; i < 5; i++) {
        const state = {
          ...testState,
          activeInstance: {
            ...testState.activeInstance!,
            id: `550e8400-e29b-41d4-a716-44665544000${i}`,
          },
        };
        await backupManager.createBackup(state);
        await Bun.sleep(10);
      }
      
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(3);
      
      const latestBackupContent = await Bun.file(join(testBackupDir, backups[0].filename)).text();
      const latestState = yaml.load(latestBackupContent) as ChecklistState;
      expect(latestState.activeInstance?.id).toBe('550e8400-e29b-41d4-a716-446655440004');
    });

    it('should delete old backup files during rotation', async () => {
      await backupManager.initializeManifest();
      
      const firstBackupPath = await backupManager.createBackup(testState);
      
      for (let i = 0; i < 4; i++) {
        await Bun.sleep(10);
        await backupManager.createBackup(testState);
      }
      
      expect(existsSync(firstBackupPath)).toBe(false);
    });
  });

  describe('Backup Recovery', () => {
    it('should recover from latest backup', async () => {
      await backupManager.initializeManifest();
      
      const modifiedState = {
        ...testState,
        activeInstance: {
          ...testState.activeInstance!,
          id: '550e8400-e29b-41d4-a716-446655440001',
        },
      };
      
      await backupManager.createBackup(testState);
      await Bun.sleep(10);
      await backupManager.createBackup(modifiedState);
      
      const recovered = await backupManager.recoverFromLatestBackup();
      expect(recovered.activeInstance?.id).toBe('550e8400-e29b-41d4-a716-446655440001');
    });

    it('should recover from specific backup', async () => {
      await backupManager.initializeManifest();
      const backupPath = await backupManager.createBackup(testState);
      const filename = backupPath.split('/').pop()!;
      
      const recovered = await backupManager.recoverFromBackup(filename);
      expect(recovered.activeInstance?.id).toBe(testState.activeInstance?.id);
    });

    it('should handle missing backup gracefully', async () => {
      await expect(
        backupManager.recoverFromBackup('nonexistent.yaml')
      ).rejects.toThrow(RecoveryError);
    });

    it('should handle corrupted backup', async () => {
      await backupManager.initializeManifest();
      
      const backupPath = join(testBackupDir, 'corrupted.yaml.123');
      await Bun.write(backupPath, 'invalid yaml content {{{');
      
      await expect(
        backupManager.recoverFromBackup('corrupted.yaml.123')
      ).rejects.toThrow(RecoveryError);
    });

    it('should try multiple backups on recovery failure', async () => {
      await backupManager.initializeManifest();
      
      const corruptedPath = join(testBackupDir, 'state.yaml.1');
      await Bun.write(corruptedPath, 'invalid content');
      
      const manifest = {
        version: '1.0.0',
        backups: [
          {
            filename: 'state.yaml.1',
            createdAt: new Date().toISOString(),
            checksum: 'invalid',
            size: 100,
            schemaVersion: '1.0.0',
          },
        ],
        rotationPolicy: { maxCount: 3 },
      };
      await Bun.write(join(testBackupDir, 'manifest.yaml'), yaml.dump(manifest));
      
      await backupManager.createBackup(testState);
      
      const recovered = await backupManager.recoverFromLatestBackup();
      expect(recovered.activeInstance?.id).toBe(testState.activeInstance?.id);
    });

    it('should throw when no backups available', async () => {
      await backupManager.initializeManifest();
      
      await expect(
        backupManager.recoverFromLatestBackup()
      ).rejects.toThrow(RecoveryError);
    });
  });

  describe('Backup Information', () => {
    it('should list all backups', async () => {
      await backupManager.initializeManifest();
      
      await backupManager.createBackup(testState);
      await Bun.sleep(10);
      await backupManager.createBackup(testState);
      
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(2);
      expect(backups[0].createdAt).toBeDefined();
      expect(backups[0].size).toBeGreaterThan(0);
    });

    it('should get specific backup info', async () => {
      await backupManager.initializeManifest();
      const backupPath = await backupManager.createBackup(testState);
      const filename = backupPath.split('/').pop()!;
      
      const info = await backupManager.getBackupInfo(filename);
      expect(info).toBeDefined();
      expect(info?.filename).toBe(filename);
      expect(info?.schemaVersion).toBe(testState.schemaVersion);
    });

    it('should return undefined for non-existent backup', async () => {
      await backupManager.initializeManifest();
      
      const info = await backupManager.getBackupInfo('nonexistent.yaml');
      expect(info).toBeUndefined();
    });
  });

  describe('Backup Cleanup', () => {
    it('should cleanup old backups', async () => {
      await backupManager.initializeManifest();
      
      await backupManager.createBackup(testState);
      await Bun.sleep(100);
      await backupManager.createBackup(testState);
      
      const deletedCount = await backupManager.cleanupOldBackups(50);
      
      expect(deletedCount).toBe(1);
      
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(1);
    });

    it('should not delete recent backups', async () => {
      await backupManager.initializeManifest();
      
      await backupManager.createBackup(testState);
      await backupManager.createBackup(testState);
      
      const deletedCount = await backupManager.cleanupOldBackups(60 * 60 * 1000);
      
      expect(deletedCount).toBe(0);
      
      const backups = await backupManager.listBackups();
      expect(backups).toHaveLength(2);
    });
  });

  describe('Backup Verification', () => {
    it('should verify valid backup', async () => {
      await backupManager.initializeManifest();
      const backupPath = await backupManager.createBackup(testState);
      const filename = backupPath.split('/').pop()!;
      
      const isValid = await backupManager.verifyBackup(filename);
      expect(isValid).toBe(true);
    });

    it('should detect invalid backup', async () => {
      await backupManager.initializeManifest();
      
      const invalidPath = join(testBackupDir, 'invalid.yaml.123');
      await Bun.write(invalidPath, 'not valid yaml {{{');
      
      const isValid = await backupManager.verifyBackup('invalid.yaml.123');
      expect(isValid).toBe(false);
    });

    it('should verify all backups', async () => {
      await backupManager.initializeManifest();
      
      await backupManager.createBackup(testState);
      
      const invalidPath = join(testBackupDir, 'invalid.yaml.123');
      await Bun.write(invalidPath, 'invalid content');
      
      const manifest = await Bun.file(join(testBackupDir, 'manifest.yaml')).text();
      const manifestData = yaml.load(manifest) as BackupManifest;
      manifestData.backups.push({
        filename: 'invalid.yaml.123',
        createdAt: new Date().toISOString(),
        checksum: 'invalid',
        size: 100,
        schemaVersion: '1.0.0',
      });
      await Bun.write(join(testBackupDir, 'manifest.yaml'), yaml.dump(manifestData));
      
      const results = await backupManager.verifyAllBackups();
      
      expect(results.size).toBe(2);
      const validCount = Array.from(results.values()).filter((v) => v).length;
      expect(validCount).toBe(1);
    });
  });
});
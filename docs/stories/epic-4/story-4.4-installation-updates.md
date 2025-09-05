# Story 4.4: Installation & Updates

## Overview

Create seamless installation experience and auto-update functionality for keeping the application current.

## Story Details

- **Epic**: 4 - Production Readiness
- **Type**: Feature
- **Priority**: Medium
- **Estimated Effort**: 1 day
- **Dependencies**: [4.3]
- **Note**: POST-MVP

## Description

Implement one-line installation scripts, auto-update checking, version migration support, and rollback capability.

## Acceptance Criteria

- [ ] One-line installation script for all platforms
- [ ] Auto-update checking on startup
- [ ] Version comparison and notification
- [ ] Self-update command
- [ ] Version migration for breaking changes
- [ ] Rollback to previous version
- [ ] Update changelog display
- [ ] Offline update support
- [ ] Update preferences configuration
- [ ] Installation verification

## Technical Requirements

### Installation Script

```bash
#!/bin/sh
# install.sh - One-line installer
# curl -fsSL https://install.bmad.dev/checklist | sh

set -e

# Detect platform
OS="$(uname -s)"
ARCH="$(uname -m)"

# Determine download URL
case "$OS" in
  Darwin) PLATFORM="macos" ;;
  Linux) PLATFORM="linux" ;;
  *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download latest version
VERSION=$(curl -s https://api.github.com/repos/bmad/checklist/releases/latest | grep tag_name | cut -d'"' -f4)
URL="https://github.com/bmad/checklist/releases/download/$VERSION/checklist-$PLATFORM-$ARCH"

echo "Installing checklist $VERSION for $PLATFORM-$ARCH..."
curl -L "$URL" -o /tmp/checklist
chmod +x /tmp/checklist
sudo mv /tmp/checklist /usr/local/bin/checklist

echo " Checklist installed successfully!"
checklist --version
```

### Auto-Update System

```typescript
class AutoUpdater {
  async checkForUpdates(): Promise<UpdateInfo | null> {
    const current = getCurrentVersion();
    const latest = await fetchLatestVersion();

    if (semver.gt(latest.version, current)) {
      return {
        current,
        latest: latest.version,
        changelog: latest.changelog,
        downloadUrl: latest.downloadUrl,
      };
    }

    return null;
  }

  async performUpdate(update: UpdateInfo): Promise<void> {
    // Backup current version
    await this.backup();

    try {
      // Download new version
      const binary = await this.download(update.downloadUrl);

      // Verify checksum
      await this.verify(binary, update.checksum);

      // Replace binary
      await this.replace(binary);

      // Migrate configuration
      await this.migrate(update.current, update.latest);
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }
}
```

### Version Migration

```typescript
// migrations/1.0.0-to-2.0.0.ts
export async function migrate(config: V1Config): Promise<V2Config> {
  return {
    ...config,
    // New structure
    version: '2.0.0',
    templates: config.workflows, // Renamed field
    settings: {
      ...config.preferences, // Moved settings
      new_feature: true, // New default
    },
  };
}
```

## Testing Requirements

- [ ] Installation script testing on all platforms
- [ ] Update mechanism testing
- [ ] Migration testing between versions
- [ ] Rollback functionality testing
- [ ] Offline scenario testing

## Definition of Done

- [ ] One-line installer working
- [ ] Auto-update checking functional
- [ ] Version migrations tested
- [ ] Rollback capability verified
- [ ] Documentation complete

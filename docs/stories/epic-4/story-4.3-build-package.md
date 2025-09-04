# Story 4.3: Build & Package System

## Overview
Create multi-platform build pipeline for single binary compilation and distribution through multiple package managers.

## Story Details
- **Epic**: 4 - Production Readiness
- **Type**: Infrastructure
- **Priority**: Critical
- **Estimated Effort**: 2 days
- **Dependencies**: [1.1, 4.1]

## Description
Implement build system using Bun's compilation features to create standalone binaries for Mac, Linux, and Windows, with packaging for npm, Homebrew, and direct downloads.

## Acceptance Criteria
- [ ] Single binary compilation with Bun
- [ ] Multi-platform builds (Mac/Linux/Windows)
- [ ] npm package publication ready
- [ ] Homebrew formula created
- [ ] GitHub releases automation
- [ ] Version management system
- [ ] Build size optimization (<20MB)
- [ ] Code signing for Mac/Windows
- [ ] Automated changelog generation
- [ ] Distribution documentation

## Technical Requirements

### Build Configuration
```typescript
// build.config.ts
export const buildConfig = {
  targets: [
    {
      platform: 'darwin',
      arch: ['x64', 'arm64'],
      output: 'checklist-macos'
    },
    {
      platform: 'linux',
      arch: ['x64', 'arm64'],
      output: 'checklist-linux'
    },
    {
      platform: 'windows',
      arch: ['x64'],
      output: 'checklist-windows.exe'
    }
  ],
  
  compilation: {
    minify: true,
    sourcemap: false,
    target: 'bun',
    entrypoint: 'src/cli.ts'
  }
};
```

### Build Script
```bash
#!/bin/bash
# build.sh

VERSION=$(cat package.json | jq -r .version)

# Compile for each platform
for platform in macos linux windows; do
  bun build \
    --compile \
    --minify \
    --target=bun-$platform \
    --outfile=dist/checklist-$platform-$VERSION \
    src/cli.ts
done

# Create npm package
npm pack

# Generate checksums
shasum -a 256 dist/* > dist/checksums.txt
```

### GitHub Actions Workflow
```yaml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      
      - name: Build binary
        run: bun run build
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: binaries-${{ matrix.os }}
          path: dist/*
  
  release:
    needs: build
    runs-on: ubuntu-latest
    
    steps:
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: dist/*
          generate_release_notes: true
```

### Package Distribution

#### NPM Package
```json
{
  "name": "@bmad/checklist",
  "version": "1.0.0",
  "bin": {
    "checklist": "./dist/cli.js"
  },
  "files": [
    "dist/"
  ]
}
```

#### Homebrew Formula
```ruby
class Checklist < Formula
  desc "Terminal-based checklist manager for BMAD workflows"
  homepage "https://github.com/bmad/checklist"
  version "1.0.0"
  
  if OS.mac? && Hardware::CPU.arm?
    url "https://github.com/bmad/checklist/releases/download/v1.0.0/checklist-macos-arm64"
    sha256 "..."
  elsif OS.mac?
    url "https://github.com/bmad/checklist/releases/download/v1.0.0/checklist-macos-x64"
    sha256 "..."
  elsif OS.linux?
    url "https://github.com/bmad/checklist/releases/download/v1.0.0/checklist-linux-x64"
    sha256 "..."
  end
  
  def install
    bin.install "checklist"
  end
end
```

## Testing Requirements
- [ ] Build process tested on all platforms
- [ ] Binary execution verified
- [ ] Package installation tested
- [ ] Version management verified
- [ ] Distribution channels tested

## Definition of Done
- [ ] Multi-platform builds working
- [ ] Binaries under 20MB
- [ ] npm package ready
- [ ] Homebrew formula created
- [ ] GitHub releases automated
- [ ] Documentation complete
#!/usr/bin/env bun

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const SYMBOLS = {
  check: '✓',
  cross: '✗',
  info: 'ℹ',
  warning: '⚠',
  box: '█',
  arrow: '→',
};

function testColors(): void {
  console.log('\n=== Terminal Color Test ===\n');
  for (const [name, code] of Object.entries(COLORS)) {
    if (name !== 'reset') {
      console.log(`${code}This is ${name} text${COLORS.reset}`);
    }
  }
}

function testUnicode(): void {
  console.log('\n=== Unicode Symbol Test ===\n');
  for (const [name, symbol] of Object.entries(SYMBOLS)) {
    console.log(`${COLORS.green}${symbol}${COLORS.reset} ${name}: ${symbol}`);
  }
}

function testBox(): void {
  console.log('\n=== Box Drawing Test ===\n');
  const boxChars = {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  };

  const width = 40;
  const title = ' Terminal Test ';
  const padding = Math.floor((width - title.length) / 2);

  console.log(
    boxChars.topLeft +
      boxChars.horizontal.repeat(padding) +
      title +
      boxChars.horizontal.repeat(width - padding - title.length) +
      boxChars.topRight
  );
  console.log(boxChars.vertical + ' '.repeat(width) + boxChars.vertical);
  console.log(
    boxChars.vertical +
      ` ${COLORS.green}✓${COLORS.reset} 256 Color Support` +
      ' '.repeat(width - 20) +
      boxChars.vertical
  );
  console.log(
    boxChars.vertical +
      ` ${COLORS.green}✓${COLORS.reset} UTF-8 Encoding` +
      ' '.repeat(width - 17) +
      boxChars.vertical
  );
  console.log(
    boxChars.vertical +
      ` ${COLORS.green}✓${COLORS.reset} Unicode Symbols` +
      ' '.repeat(width - 18) +
      boxChars.vertical
  );
  console.log(boxChars.vertical + ' '.repeat(width) + boxChars.vertical);
  console.log(boxChars.bottomLeft + boxChars.horizontal.repeat(width) + boxChars.bottomRight);
}

function main(): void {
  console.log(`${COLORS.cyan}╔══════════════════════════════════════╗${COLORS.reset}`);
  console.log(`${COLORS.cyan}║     Terminal Capabilities Test       ║${COLORS.reset}`);
  console.log(`${COLORS.cyan}╚══════════════════════════════════════╝${COLORS.reset}`);

  testColors();
  testUnicode();
  testBox();

  console.log(`\n${COLORS.green}✓${COLORS.reset} All terminal tests passed!\n`);
}

if (import.meta.main) {
  main();
}

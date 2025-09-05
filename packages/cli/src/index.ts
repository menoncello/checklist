#!/usr/bin/env bun

import { initialize } from '@checklist/core';
import { render } from '@checklist/tui';
import { log } from '@checklist/shared';

function main(): void {
  log('Checklist CLI starting...');
  initialize();
  render('Welcome to Checklist!');
}

if (import.meta.main) {
  main();
}

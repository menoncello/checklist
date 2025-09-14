#!/bin/bash

# Convert remaining interfaces to classes

# KeyBindingManager interfaces
sed -i '' 's/export interface KeyModifiers {/export class KeyModifiers {/' src/events/helpers/KeyBindingManager.ts
sed -i '' 's/export interface KeyEvent {/export class KeyEvent {/' src/events/helpers/KeyBindingManager.ts
sed -i '' 's/export interface KeyBindingOptions {/export class KeyBindingOptions {/' src/events/helpers/KeyBindingManager.ts
sed -i '' 's/export interface KeyBinding {/export class KeyBinding {/' src/events/helpers/KeyBindingManager.ts
sed -i '' 's/export interface ParsedKeyBinding {/export class ParsedKeyBinding {/' src/events/helpers/KeyBindingManager.ts

# MetricsTracker interface
sed -i '' 's/export interface MetricFilter {/export class MetricFilter {/' src/performance/helpers/MetricsTracker.ts

# Other interfaces that might still exist
grep -r "export interface" src/events/helpers/ src/errors/helpers/ src/performance/helpers/ | while IFS=: read -r file rest; do
  interface_name=$(echo "$rest" | sed -n 's/export interface \([A-Za-z][A-Za-z0-9]*\).*/\1/p')
  if [ -n "$interface_name" ]; then
    echo "Converting interface $interface_name in $file"
    sed -i '' "s/export interface $interface_name {/export class $interface_name {/" "$file"
  fi
done

echo "Conversion complete"
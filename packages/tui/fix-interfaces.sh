#!/bin/bash

# Convert specific interfaces to classes with proper field declarations
# This is needed because Bun has issues with interface exports in test files

# Function to convert interface to class
convert_interface_to_class() {
  local file=$1
  local interface_name=$2

  echo "Converting $interface_name in $file"

  # Create a temporary file
  tmp_file=$(mktemp)

  # Use awk to convert interface to class
  awk -v iname="$interface_name" '
    /^export interface '"$interface_name"' \{/ {
      print "export class " iname " {"
      in_interface = 1
      next
    }
    in_interface && /^}/ {
      print "}"
      in_interface = 0
      next
    }
    in_interface {
      # Convert interface fields to class fields
      gsub(/;/, "!;")
      gsub(/\?:/, "?:")
      gsub(/: /, "!: ")
      gsub(/\?!:/, "?:")
      print
      next
    }
    { print }
  ' "$file" > "$tmp_file"

  # Move temp file back
  mv "$tmp_file" "$file"
}

# Fix the specific ones causing issues first
convert_interface_to_class "src/events/helpers/SubscriberManager.ts" "Subscriber"
convert_interface_to_class "src/events/helpers/SubscriberManager.ts" "MessageFilter"
convert_interface_to_class "src/errors/helpers/StateSerializerManager.ts" "StateSerializer"
convert_interface_to_class "src/errors/helpers/SnapshotManager.ts" "PreservedState"
convert_interface_to_class "src/errors/helpers/SnapshotManager.ts" "StateSnapshot"
convert_interface_to_class "src/performance/helpers/BenchmarkManager.ts" "PerformanceBenchmark"
convert_interface_to_class "src/performance/helpers/BenchmarkManager.ts" "BenchmarkFilter"
convert_interface_to_class "src/performance/helpers/MetricsTracker.ts" "PerformanceMetric"

echo "Conversion complete"
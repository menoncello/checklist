#!/bin/bash

# Find all TypeScript files in packages/tui/src and remove .js extensions from imports
find packages/tui/src -name "*.ts" -type f | while read -r file; do
  # Use sed to remove .js extensions from import statements
  sed -i '' "s/from '\(.*\)\.js'/from '\1'/g" "$file"
  sed -i '' 's/from "\(.*\)\.js"/from "\1"/g' "$file"
done

echo "Fixed .js extensions in TUI package imports"
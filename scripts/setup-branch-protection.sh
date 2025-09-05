#!/bin/bash

# Setup Branch Protection for GitHub Repository
# Usage: ./scripts/setup-branch-protection.sh

set -e

echo "🔒 Setting up branch protection for main branch..."

# Get repository info
REPO_INFO=$(gh repo view --json nameWithOwner -q .nameWithOwner)

if [ -z "$REPO_INFO" ]; then
    echo "❌ Error: Could not detect repository. Make sure you're in a git repository."
    exit 1
fi

echo "📦 Repository: $REPO_INFO"

# Create protection rules
echo "⚙️  Applying protection rules..."

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "repos/$REPO_INFO/branches/main/protection" \
  --input - << EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": []
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false
}
EOF

if [ $? -eq 0 ]; then
    echo "✅ Branch protection successfully configured!"
    echo ""
    echo "📋 Applied settings:"
    echo "  • Require pull request reviews (1 approval)"
    echo "  • Dismiss stale reviews on new commits"
    echo "  • Require branches to be up to date"
    echo "  • Require conversation resolution"
    echo "  • Prevent force pushes and deletions"
    echo ""
    echo "ℹ️  Note: Status checks will be automatically added when workflows run"
else
    echo "❌ Failed to set branch protection. You may need admin permissions."
    echo "Please configure manually at: https://github.com/$REPO_INFO/settings/branches"
fi
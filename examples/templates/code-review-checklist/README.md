# Code Review Checklist Template

Comprehensive code review checklist for pull request reviews with quality, security, and performance considerations.

## Features

- Complete PR context verification
- Code quality assessment
- Security review checklist
- Performance impact evaluation
- Test coverage validation
- Documentation completeness check
- Accessibility and mobile responsiveness
- Dependency review
- CI/CD pipeline verification

## Usage

```bash
# Install the template
bmad template install code-review-checklist

# Use the template
bmad template use code-review-checklist
```

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| prNumber | Pull request number | Yes | - |
| prTitle | Pull request title | Yes | - |
| prAuthor | Pull request author | Yes | - |
| reviewer | Name of the reviewer | Yes | - |
| prType | Type of changes (feature, bugfix, refactor, docs) | No | feature |
| hasTests | PR includes tests (yes/no) | No | yes |

## Examples

### Feature PR Review

```bash
bmad template use code-review-checklist \
  --prNumber "123" \
  --prTitle "Add user authentication" \
  --prAuthor "john.doe" \
  --reviewer "jane.smith" \
  --prType "feature" \
  --hasTests "yes"
```

### Bug Fix Review

```bash
bmad template use code-review-checklist \
  --prNumber "456" \
  --prTitle "Fix memory leak in data processor" \
  --prAuthor "alice" \
  --reviewer "bob" \
  --prType "bugfix"
```

### Documentation PR Review

```bash
bmad template use code-review-checklist \
  --prNumber "789" \
  --prTitle "Update API documentation" \
  --prAuthor "charlie" \
  --reviewer "diana" \
  --prType "docs" \
  --hasTests "no"
```

## Review Categories

1. **Description & Context** - PR clarity and completeness
2. **Scope** - Focused changes, atomic commits
3. **Code Quality** - Standards, naming, abstraction
4. **Functionality** - Works as intended, edge cases
5. **Test Coverage** - Unit tests, integration tests
6. **Security** - Vulnerabilities, input validation
7. **Performance** - Query optimization, caching
8. **Error Handling** - Graceful failures, logging
9. **API Design** - RESTful principles, consistency
10. **Documentation** - Comments, README, changelog
11. **Accessibility** - WCAG compliance, keyboard navigation
12. **Mobile Responsiveness** - Works on all devices
13. **Dependencies** - Security, licensing, size impact
14. **CI/CD** - All checks passing
15. **Final Approval** - Review decision and feedback

## Best Practices

- Review code in small, focused sessions
- Provide constructive feedback
- Ask questions instead of making demands
- Praise good practices
- Focus on high-impact issues first
- Be objective and professional
- Test changes locally when possible
- Consider the broader impact

## License

MIT

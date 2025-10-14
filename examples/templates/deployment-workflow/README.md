# Deployment Workflow Template

Production-ready deployment workflow with comprehensive safety checks, monitoring, and rollback planning.

## Features

- Pre-deployment verification checklist
- Backup and rollback planning
- Database migration management
- Service deployment steps
- Health checks and smoke tests
- Monitoring and alerting
- Documentation and notifications
- Post-deployment review

## Usage

```bash
# Install the template
bmad template install deployment-workflow

# Use the template
bmad template use deployment-workflow
```

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| serviceName | Name of the service being deployed | Yes | - |
| environment | Target environment (development/staging/production) | Yes | - |
| version | Version being deployed (semver format) | Yes | - |
| deployedBy | Person performing the deployment | Yes | - |
| rollbackPlan | Rollback plan if deployment fails | No | Revert to previous version |
| includeDatabase | Include database migration steps | No | false |

## Examples

### Production Deployment

```bash
bmad template use deployment-workflow \
  --serviceName "user-api" \
  --environment "production" \
  --version "2.5.0" \
  --deployedBy "ops-team" \
  --includeDatabase "true"
```

### Staging Deployment

```bash
bmad template use deployment-workflow \
  --serviceName "payment-service" \
  --environment "staging" \
  --version "1.3.0-rc.1" \
  --deployedBy "alice.smith"
```

### Development Deployment

```bash
bmad template use deployment-workflow \
  --serviceName "notification-service" \
  --environment "development" \
  --version "3.0.0-beta.2" \
  --deployedBy "dev-team" \
  --rollbackPlan "Reset to main branch"
```

## Deployment Steps

1. **Pre-deployment Checklist** - Verify tests, reviews, security
2. **Backup Current State** - Create rollback point
3. **Notify Team** - Send deployment start notification
4. **Database Migration** - Run migrations (if applicable)
5. **Stop Services** - Gracefully shutdown (if needed)
6. **Deploy Build** - Upload and deploy new version
7. **Start Services** - Bring services online
8. **Health Checks** - Verify service health
9. **Smoke Tests** - Run critical path tests
10. **Monitor Metrics** - Watch for 15-30 minutes
11. **Update Documentation** - Record deployment details
12. **Notify Completion** - Send success notification
13. **Post-deployment Review** - Schedule retrospective

## Safety Considerations

### Pre-deployment

- All tests must pass
- Code review completed
- Security scans clean
- Stakeholders notified
- Rollback plan documented

### During Deployment

- Always create backups first
- Test migrations on staging
- Monitor error rates closely
- Have rollback plan ready
- Communicate status to team

### Post-deployment

- Monitor for 15-30 minutes minimum
- Watch error logs carefully
- Verify critical user flows
- Be ready to rollback quickly
- Document any issues

## Environment-Specific Notes

### Development
- Fast deployment cycles
- Automated testing only
- Minimal notifications
- Quick rollback OK

### Staging
- Production-like environment
- Full test suite execution
- Team notifications
- Test rollback procedures

### Production
- Maximum safety checks
- Extensive monitoring
- All stakeholders notified
- Documented rollback plan
- 24-hour monitoring period

## Requirements

- Access to deployment environment
- Backup system configured
- Monitoring tools in place
- Communication channels setup
- Rollback procedures tested

## License

MIT

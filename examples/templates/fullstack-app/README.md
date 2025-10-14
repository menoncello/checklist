# Fullstack Application Template

Complete fullstack application setup with frontend, backend, database, and deployment configuration. Includes comprehensive steps for building production-ready applications.

## Features

- Monorepo structure setup
- Frontend framework integration (React, Vue, Angular, Svelte)
- Backend framework setup (Express, Fastify, NestJS, Koa)
- Database configuration (PostgreSQL, MySQL, MongoDB, SQLite)
- Docker containerization (optional)
- CI/CD pipeline setup (optional)
- Security hardening
- Performance optimization
- Monitoring and logging
- Comprehensive documentation

## Usage

```bash
# Install the template
bmad template install fullstack-app

# Use the template
bmad template use fullstack-app
```

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| appName | Name of the fullstack application | Yes | - |
| frontendFramework | Frontend framework (react, vue, angular, svelte) | No | react |
| backendFramework | Backend framework (express, fastify, nestjs, koa) | No | express |
| database | Database system (postgres, mysql, mongodb, sqlite) | No | postgres |
| author | Application author or team name | Yes | - |
| includeDocker | Include Docker setup (true/false) | No | true |
| includeCI | Include CI/CD pipeline (true/false) | No | true |
| deploymentTarget | Deployment target (aws, azure, gcp, heroku, vercel) | No | aws |

## Examples

### React + Express + PostgreSQL

```bash
bmad template use fullstack-app \
  --appName "ecommerce-platform" \
  --frontendFramework "react" \
  --backendFramework "express" \
  --database "postgres" \
  --author "dev-team" \
  --includeDocker "true" \
  --includeCI "true" \
  --deploymentTarget "aws"
```

### Vue + Fastify + MongoDB

```bash
bmad template use fullstack-app \
  --appName "blog-platform" \
  --frontendFramework "vue" \
  --backendFramework "fastify" \
  --database "mongodb" \
  --author "alice.smith" \
  --includeDocker "true"
```

### Svelte + NestJS + MySQL

```bash
bmad template use fullstack-app \
  --appName "task-manager" \
  --frontendFramework "svelte" \
  --backendFramework "nestjs" \
  --database "mysql" \
  --author "bob.jones" \
  --includeCI "true" \
  --deploymentTarget "vercel"
```

## Application Architecture

### Monorepo Structure

```
app-name/
├── packages/
│   ├── frontend/     # Frontend application
│   ├── backend/      # Backend API
│   ├── shared/       # Shared types/utilities
│   └── database/     # Database schemas/migrations
├── docker-compose.yml
├── .github/workflows/
└── README.md
```

### Technology Stacks

#### Frontend Options
- **React**: Modern, component-based UI
- **Vue**: Progressive framework, easy learning curve
- **Angular**: Enterprise-grade, opinionated
- **Svelte**: Compiler-based, minimal runtime

#### Backend Options
- **Express**: Minimal, flexible, widely used
- **Fastify**: High performance, schema-based
- **NestJS**: Enterprise, TypeScript-first, Angular-inspired
- **Koa**: Lightweight, modern middleware

#### Database Options
- **PostgreSQL**: Relational, ACID, full-featured
- **MySQL**: Relational, mature, performant
- **MongoDB**: Document-based, flexible schema
- **SQLite**: Embedded, serverless, simple

## Setup Steps

1. **Project Foundation** - Initialize with basic-project-setup template
2. **Monorepo Configuration** - Setup workspace structure
3. **Frontend Setup** - Install and configure frontend framework
4. **Backend Setup** - Install and configure backend framework
5. **Database Setup** - Configure database and migrations
6. **API Integration** - Connect frontend to backend
7. **Docker Setup** - Containerize application (optional)
8. **Environment Configuration** - Setup env variables
9. **Testing Setup** - Configure comprehensive testing
10. **CI/CD Pipeline** - Setup automation (optional)
11. **Monitoring & Logging** - Configure observability
12. **Security Hardening** - Implement security measures
13. **Performance Optimization** - Optimize application
14. **Documentation** - Write comprehensive docs
15. **Code Review Process** - Establish review workflow (optional)
16. **Launch Preparation** - Final checks before launch

## Dependencies

This template depends on other templates:
- **basic-project-setup** (required) - Project initialization
- **deployment-workflow** (required) - Deployment automation
- **code-review-checklist** (optional) - Code review process

## Requirements

### Development Environment
- Node.js 18+ or Bun 1.0+
- Git 2.30+
- Docker 24+ (if using Docker)
- Package manager (npm, yarn, pnpm, or bun)

### Infrastructure
- Hosting platform account (AWS/Azure/GCP/etc)
- Database hosting or local setup
- CI/CD platform (GitHub Actions/GitLab CI/etc)
- Monitoring service (optional but recommended)

## Best Practices

- Use TypeScript for type safety
- Implement comprehensive testing
- Follow security best practices
- Document architecture decisions
- Setup monitoring from day one
- Use environment variables for config
- Implement proper error handling
- Follow REST API conventions
- Use semantic versioning
- Maintain changelog

## Deployment Targets

### AWS
- EC2, ECS, or Lambda
- RDS for database
- S3 for static assets
- CloudFront for CDN

### Azure
- App Service or Container Instances
- Azure Database
- Blob Storage
- Azure CDN

### Google Cloud Platform
- Cloud Run or Compute Engine
- Cloud SQL
- Cloud Storage
- Cloud CDN

### Heroku
- Heroku Dynos
- Heroku Postgres/MongoDB
- Simple deployment

### Vercel
- Optimized for Next.js/React
- Edge functions
- Automatic SSL
- Global CDN

## Security Considerations

- HTTPS/TLS encryption
- Environment variable management
- Input validation
- SQL injection prevention
- XSS prevention
- CSRF protection
- Rate limiting
- Authentication & authorization
- Security headers
- Dependency scanning

## Performance Optimization

### Frontend
- Code splitting
- Lazy loading
- Image optimization
- Caching strategies
- Bundle size optimization

### Backend
- Database query optimization
- API response caching
- Connection pooling
- Load balancing
- CDN integration

## License

MIT

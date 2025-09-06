import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'js-yaml';

describe('GitHub Workflow Validation', () => {
  const projectRoot = process.cwd();
  const mainWorkflowPath = join(projectRoot, '.github', 'workflows', 'main.yml');

  test('main.yml workflow should exist', () => {
    expect(existsSync(mainWorkflowPath)).toBe(true);
  });

  test('main.yml should be valid YAML', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    expect(() => load(content)).not.toThrow();
  });

  test('main.yml should have required structure', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    // Check workflow name
    expect(workflow.name).toBe('CI/CD Pipeline');
    
    // Check triggers
    expect(workflow.on).toBeDefined();
    expect(workflow.on.push).toBeDefined();
    expect(workflow.on.pull_request).toBeDefined();
    
    // Check jobs exist
    expect(workflow.jobs).toBeDefined();
    expect(workflow.jobs.test).toBeDefined();
    expect(workflow.jobs.build).toBeDefined();
    expect(workflow.jobs.performance).toBeDefined();
    expect(workflow.jobs['quality-gates']).toBeDefined();
    
    // Check build matrix
    expect(workflow.jobs.build.strategy.matrix.os).toContain('ubuntu-latest');
    expect(workflow.jobs.build.strategy.matrix.os).toContain('macos-latest');
    expect(workflow.jobs.build.strategy.matrix.os).toContain('windows-latest');
  });

  test('workflow should use correct Bun setup action', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    const testSteps = workflow.jobs.test.steps;
    const bunSetupStep = testSteps.find((step: any) => step.name === 'Setup Bun');
    
    expect(bunSetupStep).toBeDefined();
    expect(bunSetupStep.uses).toMatch(/^oven-sh\/setup-bun@/);
  });

  test('workflow should include all required test steps', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    const testSteps = workflow.jobs.test.steps;
    const stepNames = testSteps.map((step: any) => step.name);
    
    expect(stepNames).toContain('Run TypeScript Type Check');
    expect(stepNames).toContain('Run Linting');
    expect(stepNames).toContain('Check Formatting');
    expect(stepNames).toContain('Run Tests with Coverage');
  });

  test('workflow should configure artifact uploads', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    const testSteps = workflow.jobs.test.steps;
    const uploadSteps = testSteps.filter((step: any) => 
      step.uses && step.uses.startsWith('actions/upload-artifact')
    );
    
    expect(uploadSteps.length).toBeGreaterThan(0);
    
    // Check for coverage upload
    const coverageUpload = uploadSteps.find((step: any) => 
      step.with?.name === 'coverage-report'
    );
    expect(coverageUpload).toBeDefined();
  });

  test('build job should validate binary size', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    const buildSteps = workflow.jobs.build.steps;
    const sizeValidationSteps = buildSteps.filter((step: any) => 
      step.name?.includes('Validate Binary Size')
    );
    
    expect(sizeValidationSteps.length).toBeGreaterThan(0);
    // Check that at least one validation step has size limit
    const hasLimitCheck = sizeValidationSteps.some((step: any) => 
      step.run?.includes('MB')
    );
    expect(hasLimitCheck).toBe(true);
  });

  test('quality gates should check all job results', () => {
    const content = readFileSync(mainWorkflowPath, 'utf-8');
    const workflow = load(content) as any;
    
    const qualityGates = workflow.jobs['quality-gates'];
    
    expect(qualityGates.needs).toContain('test');
    expect(qualityGates.needs).toContain('build');
    expect(qualityGates.needs).toContain('performance');
    expect(qualityGates.if).toBe('always()');
  });
});
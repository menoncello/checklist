import { describe, test, beforeAll, expect } from 'bun:test';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';
import { withTiming, Timed } from '../../src/monitoring/decorators';

// Mock workflow classes for benchmarking
class MockWorkflowEngine {
  private performanceMonitor: PerformanceMonitorService;
  
  constructor(monitor: PerformanceMonitorService) {
    this.performanceMonitor = monitor;
  }
  
  async initialize(): Promise<void> {
    const timer = this.performanceMonitor.startTimer('workflow-initialize');
    this.performanceMonitor.setBudget('workflow-initialize', 500, 'critical');
    
    try {
      // Simulate workflow engine initialization
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      
      // Simulate loading templates, configurations, etc.
      const templates = Array(50).fill(0).map((_, i) => ({
        id: `template-${i}`,
        steps: Array(20).fill(0).map((_, j) => ({ id: `step-${j}` })),
      }));
      
      return Promise.resolve();
    } finally {
      timer();
    }
  }

  async loadTemplate(templateId: string): Promise<any> {
    const timer = this.performanceMonitor.startTimer('workflow-load-template');
    this.performanceMonitor.setBudget('workflow-load-template', 100, 'critical');
    
    try {
      // Simulate template loading with parsing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 5));
      
      const template = {
        id: templateId,
        version: '1.0.0',
        metadata: {
          name: `Template ${templateId}`,
          description: 'Test template',
          created: Date.now(),
        },
        steps: Array(100).fill(0).map((_, i) => ({
          id: `step-${i}`,
          title: `Step ${i}`,
          type: 'task',
          required: i % 5 === 0,
          dependencies: i > 0 ? [`step-${i - 1}`] : [],
          validation: {
            type: 'boolean',
            required: true,
          },
        })),
      };
      
      return template;
    } finally {
      timer();
    }
  }

  async executeStep(stepId: string): Promise<boolean> {
    const timer = this.performanceMonitor.startTimer('workflow-execute-step');
    this.performanceMonitor.setBudget('workflow-execute-step', 50, 'critical');
    
    try {
      // Simulate step execution
      await new Promise(resolve => setTimeout(resolve, Math.random() * 3));
      
      // Simulate step validation and execution logic
      const isValid: boolean = !!(stepId && stepId.startsWith('step-'));
      return isValid;
    } finally {
      timer();
    }
  }

  validateWorkflow(workflow: any): boolean {
    const timer = this.performanceMonitor.startTimer('workflow-validate');
    this.performanceMonitor.setBudget('workflow-validate', 100, 'warning');
    
    try {
      // Simulate workflow validation
      return workflow &&
        workflow.steps &&
        Array.isArray(workflow.steps) &&
        workflow.steps.every((step: any) => step.id && step.title);
    } finally {
      timer();
    }
  }
}

describe('Workflow Engine Benchmarks', () => {
  let performanceMonitor: PerformanceMonitorService;
  let workflowEngine: MockWorkflowEngine;

  beforeAll(async () => {
    const logger = createLogger('benchmark:workflow');
    performanceMonitor = new PerformanceMonitorService(
      { name: 'workflow-benchmark-monitor' },
      logger
    );
    await performanceMonitor.initialize();
    workflowEngine = new MockWorkflowEngine(performanceMonitor);
  });

  // Application startup benchmark (critical requirement)
  test('Application Startup Simulation benchmark', async () => {
    const result = await withTiming('application-startup', async () => {
      // Simulate complete application startup sequence
      
      // 1. Initialize core services
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 2. Load configuration
      const config = {
        version: '1.0.0',
        features: ['workflow', 'state', 'monitoring'],
        templates: Array(20).fill(0).map((_, i) => `template-${i}`),
      };
      
      // 3. Initialize workflow engine
      await workflowEngine.initialize();
      
      // 4. Load default templates
      await workflowEngine.loadTemplate('default');
      
      // 5. Setup monitoring
      performanceMonitor.setBudget('startup-complete', 500, 'critical');
      
      return config.templates.length;
    }, { budgetMs: 500, severity: 'critical', monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('application-startup');
    if (metrics) {
      console.log(`Application Startup: ${metrics.average.toFixed(2)}ms (budget: 500ms)`);
    }
    
    expect(result).toBeGreaterThan(0);
  });

  // Workflow template parsing benchmark
  test('Template Parsing benchmark', async () => {
    const result = await withTiming('template-parsing-1000-lines', () => {
      // Simulate parsing 1000-line template
      const steps = Array(250).fill(0).map((_, i) => ({
        id: `step_${i}`,
        title: `Step ${i}`,
        required: i % 5 === 0,
        type: 'task',
      }));
      
      return steps.length;
    }, { budgetMs: 100, severity: 'critical', monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('template-parsing-1000-lines');
    if (metrics) {
      console.log(`Template Parsing: ${metrics.average.toFixed(2)}ms (budget: 100ms)`);
    }
    
    expect(result).toBe(250);
  });

  // Workflow execution benchmarks
  test('Sequential Step Execution benchmark', async () => {
    await workflowEngine.loadTemplate('sequential-test');
    
    const result = await withTiming('sequential-execution', async () => {
      const results = [];
      
      // Execute steps sequentially (simulating dependencies)
      for (let i = 0; i < 10; i++) {
        const stepResult = await workflowEngine.executeStep(`step-${i}`);
        results.push(stepResult);
      }
      
      return results.filter(r => r).length;
    }, { budgetMs: 200, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('sequential-execution');
    if (metrics) {
      console.log(`Sequential Execution: ${metrics.average.toFixed(2)}ms (budget: 200ms)`);
    }
    
    expect(result).toBe(10);
  });

  // Workflow validation benchmark
  test('Workflow Validation benchmark', async () => {
    const complexWorkflow = {
      id: 'complex-workflow',
      version: '2.0.0',
      steps: Array(100).fill(0).map((_, i) => ({
        id: `step-${i}`,
        title: `Complex Step ${i}`,
        type: i % 3 === 0 ? 'task' : 'decision',
        required: i % 4 === 0,
      })),
    };

    const result = await withTiming('complex-workflow-validation', () => {
      const isValid = workflowEngine.validateWorkflow(complexWorkflow);
      
      return {
        valid: isValid,
        stepCount: complexWorkflow.steps.length,
      };
    }, { budgetMs: 100, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('complex-workflow-validation');
    if (metrics) {
      console.log(`Workflow Validation: ${metrics.average.toFixed(2)}ms (budget: 100ms)`);
    }
    
    expect(result.valid).toBe(true);
    expect(result.stepCount).toBe(100);
  });
});
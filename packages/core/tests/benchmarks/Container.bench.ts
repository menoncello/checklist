import { Bench } from 'tinybench';
import { Container } from '../../src/container/Container';
import { ServiceProvider } from '../../src/container/ServiceProvider';

// Simple test services for benchmarking
class SimpleService {
  value = 'simple';
}

class ServiceWithDependency {
  constructor(public simple: SimpleService) {}
}

class ComplexService {
  constructor(
    public service1: SimpleService,
    public service2: ServiceWithDependency
  ) {}
}

// Benchmark suite
const bench = new Bench({ time: 1000 }); // Run each benchmark for 1 second

// Container benchmarks
bench
  .add('Container: Register service', () => {
    const container = new Container();
    container.register('SimpleService', SimpleService);
  })
  .add('Container: Resolve simple service (singleton)', async () => {
    const container = new Container();
    container.register('SimpleService', SimpleService, { singleton: true });
    await container.resolve('SimpleService');
  })
  .add('Container: Resolve simple service (non-singleton)', async () => {
    const container = new Container();
    container.register('SimpleService', SimpleService, { singleton: false });
    await container.resolve('SimpleService');
  })
  .add('Container: Resolve service with 1 dependency', async () => {
    const container = new Container();
    container.register('SimpleService', SimpleService);
    container.register('ServiceWithDependency', 
      (simple: unknown) => new ServiceWithDependency(simple as SimpleService), {
      dependencies: ['SimpleService'],
    });
    await container.resolve('ServiceWithDependency');
  })
  .add('Container: Resolve service with 2 dependencies', async () => {
    const container = new Container();
    container.register('SimpleService', SimpleService);
    container.register('ServiceWithDependency', 
      (simple: unknown) => new ServiceWithDependency(simple as SimpleService), {
      dependencies: ['SimpleService'],
    });
    container.register('ComplexService', 
      (service1: unknown, service2: unknown) => new ComplexService(
        service1 as SimpleService, 
        service2 as ServiceWithDependency
      ), {
      dependencies: ['SimpleService', 'ServiceWithDependency'],
    });
    await container.resolve('ComplexService');
  })
  .add('Container: Resolve cached singleton', async () => {
    const container = new Container();
    container.register('SimpleService', SimpleService, { singleton: true });
    // First resolution to cache
    await container.resolve('SimpleService');
    // Benchmark cached resolution
    await container.resolve('SimpleService');
  })
  .add('Container: Check circular dependency (3 services)', async () => {
    const container = new Container();
    container.register('A', SimpleService, { dependencies: ['B'] });
    container.register('B', SimpleService, { dependencies: ['C'] });
    container.register('C', SimpleService, { dependencies: [] });
    await container.resolve('A');
  });

// ServiceProvider benchmarks
bench
  .add('ServiceProvider: Create instance', () => {
    new ServiceProvider({ environment: 'test' });
  })
  .add('ServiceProvider: Register and resolve service', async () => {
    const provider = new ServiceProvider({ environment: 'test' });
    provider.register('SimpleService', SimpleService);
    await provider.get('SimpleService');
  })
  .add('ServiceProvider: Feature flag check', () => {
    const provider = new ServiceProvider({
      environment: 'test',
      featureFlags: { TEST_FLAG: true },
    });
    provider.isFeatureEnabled('TEST_FLAG');
  });

// Run benchmarks and report results
async function runBenchmarks() {
  console.log('🏃 Running DI Container Performance Benchmarks...\n');
  
  await bench.run();

  console.table(
    bench.tasks.map(task => ({
      'Task Name': task.name,
      'Ops/sec': task.result?.hz?.toFixed(0) ?? 'N/A',
      'Average Time (μs)': task.result?.mean?.toFixed(2) ?? 'N/A',
      'Samples': task.result?.samples?.length ?? 0,
    }))
  );

  // Check if injection meets <1ms requirement
  console.log('\n📊 Performance Analysis:\n');
  
  const results = bench.tasks.map(t => ({ name: t.name, mean: t.result?.mean }));
  const injectionBenchmarks = [
    'Container: Resolve simple service (singleton)',
    'Container: Resolve simple service (non-singleton)',
    'Container: Resolve service with 1 dependency',
    'Container: Resolve service with 2 dependencies',
    'Container: Resolve cached singleton',
  ];

  let allMeetRequirement = true;
  
  for (const result of results) {
    if (injectionBenchmarks.includes(result.name)) {
      const avgTimeMs = result.mean ? result.mean / 1000 : 0; // Convert from microseconds to milliseconds
      const meetsRequirement = avgTimeMs < 1;
      
      console.log(
        `${meetsRequirement ? '✅' : '❌'} ${result.name}: ${avgTimeMs.toFixed(4)}ms (${
          meetsRequirement ? 'PASS' : 'FAIL'
        })`
      );
      
      if (!meetsRequirement) {
        allMeetRequirement = false;
      }
    }
  }

  console.log('\n📋 Summary:');
  if (allMeetRequirement) {
    console.log('✅ All injection operations meet the <1ms performance requirement!');
  } else {
    console.log('❌ Some injection operations exceed the 1ms threshold.');
  }

  // Memory usage estimation
  const memUsage = process.memoryUsage();
  console.log('\n💾 Memory Usage:');
  console.log(`  Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
}

// Execute if run directly
if (import.meta.main) {
  runBenchmarks().catch(console.error);
}
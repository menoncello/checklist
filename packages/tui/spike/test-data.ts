export interface TestItem {
  id: string;
  label: string;
  checked: boolean;
  description: string;
}

export function generateTestData(count: number): TestItem[] {
  const items: TestItem[] = [];
  
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item-${i}`,
      label: `Task ${i + 1}`,
      checked: Math.random() > 0.7,
      description: `This is a test description for item ${i + 1} with some longer text to simulate real content`
    });
  }
  
  return items;
}

export const TEST_DATASETS = {
  SMOKE: 10,
  BENCHMARK: 1000,
  STRESS: 10000
} as const;
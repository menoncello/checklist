// performance.config.ts
export const PERFORMANCE_BUDGET = {
  startup: {
    target: 50, // ms
    max: 100, // ms
  },
  memory: {
    target: 30, // MB
    max: 50, // MB
  },
  operation: {
    target: 10, // ms
    max: 100, // ms
  },
  binarySize: {
    target: 15, // MB
    max: 20, // MB
  },
};
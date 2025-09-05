export const shared = {
  version: '0.1.0',
  name: '@checklist/shared',
};

export function log(message: string): void {
  console.log(`[SHARED]: ${message}`);
}

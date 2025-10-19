declare module 'vitest' {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(value: any): any;
  export function beforeEach(fn: () => void): void;
  export function afterEach(fn: () => void): void;
}
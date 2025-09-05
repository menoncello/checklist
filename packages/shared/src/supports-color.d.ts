declare module 'supports-color' {
  interface Level {
    level: 0 | 1 | 2 | 3;
    hasBasic: boolean;
    has256: boolean;
    has16m: boolean;
  }

  const supportsColor: {
    stdout: Level | false;
    stderr: Level | false;
  };

  export default supportsColor;
}

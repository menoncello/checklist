import { RenderFallback } from './FallbackTypes';
import { FallbackUtils } from './FallbackUtils';

export function createDefaultFallbacks(): RenderFallback[] {
  return [
    createStripColorsFallback(),
    createStripAnsieFallback(),
    createAsciiOnlyFallback(),
    createSimplifyBoxDrawingFallback(),
    createLimitDimensionsFallback(),
    createSimplifyLayoutFallback(),
  ];
}

function createStripColorsFallback(): RenderFallback {
  return {
    name: 'stripColors',
    condition: (capabilities) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return !FallbackUtils.hasColorSupport(capsObj);
    },
    transform: (content) => FallbackUtils.stripAnsiColors(content),
    priority: 90,
  };
}

function createStripAnsieFallback(): RenderFallback {
  return {
    name: 'stripAllAnsi',
    condition: (capabilities) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return FallbackUtils.isMinimalTerminal(capsObj);
    },
    transform: (content) => FallbackUtils.stripAllAnsiEscapes(content),
    priority: 85,
  };
}

function createAsciiOnlyFallback(): RenderFallback {
  return {
    name: 'asciiOnly',
    condition: (capabilities) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return !FallbackUtils.hasUnicodeSupport(capsObj);
    },
    transform: (content) => FallbackUtils.convertToAscii(content),
    priority: 80,
  };
}

function createSimplifyBoxDrawingFallback(): RenderFallback {
  return {
    name: 'simplifyBoxDrawing',
    condition: (capabilities) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return !FallbackUtils.hasUnicodeSupport(capsObj);
    },
    transform: (content) => FallbackUtils.simplifyBoxDrawing(content),
    priority: 70,
  };
}

function createLimitDimensionsFallback(): RenderFallback {
  return {
    name: 'limitDimensions',
    condition: () => false, // This is controlled by FallbackRenderer options filtering
    transform: (content, options) =>
      FallbackUtils.limitDimensions(content, options),
    priority: 60,
  };
}

function createSimplifyLayoutFallback(): RenderFallback {
  return {
    name: 'simplifyLayout',
    condition: (capabilities) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return FallbackUtils.isMinimalTerminal(capsObj);
    },
    transform: (content) => FallbackUtils.simplifyLayout(content),
    priority: 50,
  };
}

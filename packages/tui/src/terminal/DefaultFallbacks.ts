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
    condition: (capabilities, options) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return (
        options?.stripColors === true || !FallbackUtils.hasColorSupport(capsObj)
      );
    },
    transform: (content) => FallbackUtils.stripAnsiColors(content),
    priority: 90,
  };
}

function createStripAnsieFallback(): RenderFallback {
  return {
    name: 'stripAllAnsi',
    condition: (capabilities, _options) => {
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
    condition: (capabilities, options) => {
      // Don't apply if simplifyBoxDrawing is explicitly enabled (they're mutually exclusive)
      if (options?.simplifyBoxDrawing === true) {
        return false;
      }

      // Only apply if useAsciiOnly option is enabled OR if terminal doesn't support Unicode
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return (
        options?.useAsciiOnly === true ||
        !FallbackUtils.hasUnicodeSupport(capsObj)
      );
    },
    transform: (content) => FallbackUtils.convertToAscii(content),
    priority: 75,
  };
}

function createSimplifyBoxDrawingFallback(): RenderFallback {
  return {
    name: 'simplifyBoxDrawing',
    condition: (capabilities, options) => {
      // Only apply if simplifyBoxDrawing option is enabled OR if terminal doesn't support Unicode
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return (
        options?.simplifyBoxDrawing === true ||
        !FallbackUtils.hasUnicodeSupport(capsObj)
      );
    },
    transform: (content) => FallbackUtils.simplifyBoxDrawing(content),
    priority: 80,
  };
}

function createLimitDimensionsFallback(): RenderFallback {
  return {
    name: 'limitDimensions',
    condition: (_capabilities, options) => {
      // Always check - transform will handle if limiting is needed based on options
      return (
        isFinite(options?.maxWidth ?? Infinity) ||
        isFinite(options?.maxHeight ?? Infinity)
      );
    },
    transform: (content, options) => {
      // Only limit if dimensions are finite
      if (isFinite(options.maxWidth) || isFinite(options.maxHeight)) {
        return FallbackUtils.limitDimensions(content, options);
      }
      return content;
    },
    priority: 60,
  };
}

function createSimplifyLayoutFallback(): RenderFallback {
  return {
    name: 'simplifyLayout',
    condition: (capabilities, options) => {
      const capsObj = capabilities as
        | Record<string, unknown>
        | null
        | undefined;
      return (
        options?.preserveLayout === false ||
        FallbackUtils.isMinimalTerminal(capsObj)
      );
    },
    transform: (content) => FallbackUtils.simplifyLayout(content),
    priority: 50,
  };
}

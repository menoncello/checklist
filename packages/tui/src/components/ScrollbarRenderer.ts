export interface ScrollbarStyle {
  track: string;
  thumb: string;
}

export interface ScrollbarRenderOptions {
  position: number;
  maxPosition: number;
  viewportSize: number;
  trackSize: number;
  style: 'simple' | 'modern' | 'minimal';
  isHorizontal: boolean;
}

export class ScrollbarRenderer {
  private static readonly STYLES: Record<string, ScrollbarStyle> = {
    simple: { track: '─', thumb: '█' },
    modern: { track: '░', thumb: '▓' },
    minimal: { track: ' ', thumb: '■' },
  };

  static render(options: ScrollbarRenderOptions): string {
    const { position, maxPosition, viewportSize, trackSize } = options;

    if (maxPosition <= 0) return '';

    const thumbMetrics = this.calculateThumbMetrics(
      position,
      maxPosition,
      viewportSize,
      trackSize
    );

    return this.buildScrollbar(
      thumbMetrics,
      trackSize,
      options.style,
      options.isHorizontal
    );
  }

  private static calculateThumbMetrics(
    position: number,
    maxPosition: number,
    viewportSize: number,
    trackSize: number
  ): { size: number; position: number } {
    const size = Math.max(
      1,
      Math.floor((viewportSize / (viewportSize + maxPosition)) * trackSize)
    );
    const thumbPosition = Math.floor(
      (position / maxPosition) * (trackSize - size)
    );
    return { size, position: thumbPosition };
  }

  private static buildScrollbar(
    thumbMetrics: { size: number; position: number },
    trackSize: number,
    style: 'simple' | 'modern' | 'minimal',
    isHorizontal: boolean
  ): string {
    const styleConfig = this.STYLES[style];
    const trackChar = isHorizontal
      ? styleConfig.track
      : style === 'simple'
        ? '│'
        : styleConfig.track;
    const thumbChar = styleConfig.thumb;

    const track = new Array(trackSize).fill(trackChar);
    for (
      let i = thumbMetrics.position;
      i < thumbMetrics.position + thumbMetrics.size && i < trackSize;
      i++
    ) {
      track[i] = thumbChar;
    }

    return track.join('');
  }
}

export interface ScrollbarStyle {
  track: string;
  thumb: string;
}

export interface ScrollbarRenderOptions {
  position: number;
  maxPosition: number;
  viewportSize: number;
  trackSize: number;
  style: 'simple' | 'styled' | 'minimal';
  isHorizontal: boolean;
}

export class ScrollbarRenderer {
  private static readonly STYLES: Record<string, ScrollbarStyle> = {
    simple: { track: '─', thumb: '█' },
    styled: { track: '░', thumb: '▓' },
    minimal: { track: ' ', thumb: '■' },
  };

  static render(options: ScrollbarRenderOptions): string {
    const {
      position,
      maxPosition,
      viewportSize,
      trackSize,
      style,
      isHorizontal,
    } = options;

    if (maxPosition <= 0) return '';

    const thumbSize = Math.max(
      1,
      Math.floor((viewportSize / (viewportSize + maxPosition)) * trackSize)
    );
    const thumbPosition = Math.floor(
      (position / maxPosition) * (trackSize - thumbSize)
    );

    const styleConfig = this.STYLES[style];
    const trackChar = isHorizontal
      ? styleConfig.track
      : style === 'simple'
        ? '│'
        : styleConfig.track;
    const thumbChar = styleConfig.thumb;

    const track = new Array(trackSize).fill(trackChar);
    for (
      let i = thumbPosition;
      i < thumbPosition + thumbSize && i < trackSize;
      i++
    ) {
      track[i] = thumbChar;
    }

    return track.join('');
  }
}

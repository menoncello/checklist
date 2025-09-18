import { ScrollAnimation } from './ScrollableContainerTypes';

export class ScrollableContainerAnimation {
  private static readonly DEFAULT_DURATION = 300;

  static createAnimation(options: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    duration?: number;
  }): ScrollAnimation {
    const {
      startX,
      startY,
      targetX,
      targetY,
      duration = this.DEFAULT_DURATION,
    } = options;

    return {
      active: true,
      startTime: performance.now(),
      duration,
      startX,
      startY,
      targetX,
      targetY,
      easing: this.easeInOutCubic,
    };
  }

  static updateAnimation(animation: ScrollAnimation): {
    x: number;
    y: number;
    completed: boolean;
  } {
    const now = performance.now();
    const elapsed = now - animation.startTime;
    const progress = Math.min(elapsed / animation.duration, 1);

    const easedProgress = animation.easing(progress);
    const x =
      animation.startX + (animation.targetX - animation.startX) * easedProgress;
    const y =
      animation.startY + (animation.targetY - animation.startY) * easedProgress;

    return {
      x,
      y,
      completed: progress >= 1,
    };
  }

  static stopAnimation(animation: ScrollAnimation): void {
    animation.active = false;
  }

  private static easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  static easeLinear(t: number): number {
    return t;
  }

  static easeInQuad(t: number): number {
    return t * t;
  }

  static easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  static easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
}

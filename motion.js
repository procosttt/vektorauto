export const scrollDuration = (distance) => Math.min(1600, Math.max(800, Math.abs(distance) * 0.42));

export const easeScroll = (progress) => progress * progress * (3 - 2 * progress);

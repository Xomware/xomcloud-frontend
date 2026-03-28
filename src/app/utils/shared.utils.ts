// shared.utils.ts - Shared utility functions extracted from components

/**
 * Format a number with K/M suffixes for display
 */
export function formatNumber(num: number): string {
  if (num === null || num === undefined || isNaN(num)) {
    return '0';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Handle image load error by setting a fallback source
 */
export function onImageError(event: Event, fallbackSrc: string): void {
  const target = event.target as HTMLImageElement;
  if (target) {
    target.src = fallbackSrc;
  }
}

/**
 * Replace SoundCloud artwork URL size parameter
 */
export function replaceArtworkSize(url: string, size: string): string {
  const sizes = ['large', 't500x500', 'crop', 't300x300', 't67x67', 'badge'];
  let result = url;
  for (const s of sizes) {
    result = result.replace(`-${s}`, `-${size}`);
  }
  if (!result.includes(`-${size}`)) {
    result = result.replace('large', size);
  }
  return result;
}

/**
 * Get artwork URL for a track with fallback chain
 */
export function getTrackArtworkUrl(
  track: { artwork_url: string | null; user?: { avatar_url?: string } } | null,
  size: string = 'large'
): string {
  if (!track) {
    return 'assets/img/default-artwork.svg';
  }
  if (!track.artwork_url) {
    return track.user?.avatar_url
      ? replaceArtworkSize(track.user.avatar_url, size)
      : 'assets/img/default-artwork.svg';
  }
  return replaceArtworkSize(track.artwork_url, size);
}

/**
 * Get artwork URL for a playlist with fallback chain
 */
export function getPlaylistArtworkUrl(
  playlist: {
    artwork_url: string | null;
    tracks?: { artwork_url: string | null }[];
    user?: { avatar_url?: string };
  } | null,
  size: string = 'large'
): string {
  if (!playlist) {
    return 'assets/img/default-artwork.svg';
  }

  let url = playlist.artwork_url;

  if (!url && playlist.tracks?.length && playlist.tracks[0]?.artwork_url) {
    url = playlist.tracks[0].artwork_url;
  }

  if (!url) {
    return playlist.user?.avatar_url
      ? replaceArtworkSize(playlist.user.avatar_url, size)
      : 'assets/img/default-artwork.svg';
  }

  return replaceArtworkSize(url, size);
}

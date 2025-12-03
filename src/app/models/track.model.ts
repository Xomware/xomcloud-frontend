// SoundCloud Track Model
import { User } from './user.model';

export interface Track {
  id: number;
  created_at: string;
  duration: number;
  commentable: boolean;
  comment_count: number;
  sharing: 'public' | 'private';
  tag_list: string;
  streamable: boolean;
  downloadable: boolean;
  download_count: number;
  embeddable_by: string;
  purchase_url: string | null;
  purchase_title: string | null;
  label_id: number | null;
  label_name: string | null;
  isrc: string | null;
  video_url: string | null;
  track_type: string | null;
  key_signature: string | null;
  bpm: number | null;
  genre: string;
  title: string;
  description: string | null;
  license: string;
  uri: string;
  permalink: string;
  permalink_url: string;
  artwork_url: string | null;
  waveform_url: string;
  stream_url?: string;
  playback_count: number;
  likes_count: number;
  reposts_count: number;
  user: User;
  user_id: number;
  state: 'processing' | 'finished' | 'failed';
  access: 'playable' | 'preview' | 'blocked';
  media?: MediaTranscodings;
  publisher_metadata?: PublisherMetadata;
  full_duration?: number;
  display_date?: string;
}

export interface MediaTranscodings {
  transcodings: Transcoding[];
}

export interface Transcoding {
  url: string;
  preset: string;
  duration: number;
  snipped: boolean;
  format: {
    protocol: string;
    mime_type: string;
  };
  quality: string;
}

export interface PublisherMetadata {
  id: number;
  urn: string;
  artist?: string;
  album_title?: string;
  contains_music?: boolean;
  isrc?: string;
  writer_composer?: string;
}

export interface TrackCollection {
  collection: Track[];
  next_href?: string;
}

// For liked tracks
export interface LikedTrack {
  created_at: string;
  track: Track;
}

export interface LikedTrackCollection {
  collection: LikedTrack[];
  next_href?: string;
}

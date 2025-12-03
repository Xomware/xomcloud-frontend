// SoundCloud Playlist Model
import { Track } from './track.model';
import { User } from './user.model';

export interface Playlist {
  id: number;
  created_at: string;
  duration: number;
  permalink: string;
  permalink_url: string;
  title: string;
  description: string | null;
  uri: string;
  artwork_url: string | null;
  genre: string | null;
  tag_list: string;
  label_id: number | null;
  label_name: string | null;
  release: number | null;
  release_day: number | null;
  release_month: number | null;
  release_year: number | null;
  streamable: boolean;
  downloadable: boolean;
  sharing: 'public' | 'private';
  embeddable_by: string;
  purchase_url: string | null;
  purchase_title: string | null;
  license: string;
  track_count: number;
  tracks: Track[];
  user: User;
  user_id: number;
  likes_count: number;
  reposts_count: number;
  managed_by_feeds: boolean;
  set_type: string;
  is_album: boolean;
  published_at: string | null;
  display_date: string;
  secret_token?: string;
}

export interface PlaylistCollection {
  collection: Playlist[];
  next_href?: string;
}

// For creating playlists
export interface CreatePlaylistRequest {
  playlist: {
    title: string;
    description?: string;
    sharing?: 'public' | 'private';
    tracks?: { id: number }[];
  };
}

// For updating playlists
export interface UpdatePlaylistRequest {
  playlist: {
    title?: string;
    description?: string;
    sharing?: 'public' | 'private';
    tracks?: { id: number }[];
  };
}

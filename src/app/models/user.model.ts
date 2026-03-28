// SoundCloud User Model
export interface User {
  id: number;
  permalink: string;
  username: string;
  uri: string;
  permalink_url: string;
  avatar_url: string;
  country: string | null;
  full_name: string;
  city: string | null;
  description: string | null;
  discogs_name: string | null;
  myspace_name: string | null;
  website: string | null;
  website_title: string | null;
  online: boolean;
  track_count: number;
  playlist_count: number;
  followers_count: number;
  followings_count: number;
  public_favorites_count: number;
  likes_count: number;
  comments_count: number;
  reposts_count?: number;
  created_at: string;
  last_modified: string;
  first_name?: string;
  last_name?: string;
  subscription?: Subscription;
  visuals?: Visuals;
}

export interface Subscription {
  product: {
    id: string;
    name: string;
  };
}

export interface Visuals {
  enabled: boolean;
  visuals: Visual[];
  tracking: unknown;
}

export interface Visual {
  urn: string;
  entry_time: number;
  visual_url: string;
}

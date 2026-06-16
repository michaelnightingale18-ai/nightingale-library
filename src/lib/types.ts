export interface Profile {
  id: string;
  name: string;
  avatar: string; // emoji
  color: string; // hex color for their theme
  approved_level: number; // parent-approved level — gates avatar upgrades
  created_at: string;
}

export interface Book {
  id: string;
  isbn?: string | null;
  title: string;
  author: string;
  cover_url?: string | null;
  series_name?: string | null;
  series_position?: number | null;
  total_in_series?: number | null;
  description?: string | null;
  open_library_id?: string | null;
  google_books_id?: string | null;
  created_at: string;
}

export interface ReadingRecord {
  id: string;
  profile_id: string;
  book_id: string;
  read_at: string;
  liked: boolean;
  currently_reading?: boolean;
  book?: Book;
}

export interface BookWithRecord extends Book {
  liked: boolean;
  read_at: string;
  record_id: string;
  currently_reading?: boolean;
}

export interface SeriesGroup {
  series_name: string;
  author: string;
  books: BookWithRecord[];
  max_position: number;
  total_known: number;
  has_alert?: boolean;
}

export interface Recommendation {
  id: string;
  profile_id: string;
  book_title: string;
  book_author?: string | null;
  book_cover_url?: string | null;
  reason?: string | null;
  based_on_titles?: string[] | null;
  dismissed: boolean;
  created_at: string;
}

export interface ReleaseAlert {
  id: string;
  series_name: string;
  book_title: string;
  author?: string | null;
  release_info?: string | null;
  seen: boolean;
  created_at: string;
}

export interface BookSearchResult {
  title: string;
  author: string;
  cover_url?: string;
  isbn?: string;
  series_name?: string;
  series_position?: number;
  total_in_series?: number;
  description?: string;
  open_library_id?: string;
  google_books_id?: string;
}

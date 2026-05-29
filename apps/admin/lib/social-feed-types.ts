export type FeedPostType = "text" | "image" | "video" | "chart" | "article" | "idea";
export type FeedSentiment = "bullish" | "bearish" | "neutral";

export type SocialPostSymbol = {
  id: number;
  symbol: string;
  trading_symbol: string | null;
  exchange: string | null;
  token: string | null;
};

export type SocialPost = {
  id: number;
  uuid: string;
  content: string;
  post_type: FeedPostType;
  title: string | null;
  sentiment: FeedSentiment | null;
  target_price: number | null;
  stop_loss_price: number | null;
  thumbnail_url: string | null;
  article_body: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: number;
    fullName: string;
    uuid: string;
  };
  images: { id: number; url: string; sort_order: number }[];
  videos: { id: number; url: string; sort_order: number }[];
  symbols: SocialPostSymbol[];
  like_count: number;
  comment_count: number;
  save_count: number;
  liked_by_me: boolean;
  saved_by_me: boolean;
  is_own: boolean;
};

export type CreateSocialPostInput = {
  content: string;
  postType?: FeedPostType;
  title?: string;
  sentiment?: FeedSentiment;
  targetPrice?: number;
  stopLossPrice?: number;
  thumbnailUrl?: string;
  articleBody?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  symbols?: {
    symbol: string;
    tradingSymbol?: string;
    exchange?: string;
    token?: string;
  }[];
};

import { AlertCircle, ExternalLink, Image as ImageIcon } from 'lucide-react';

interface ImageMatch {
  url: string;
  similarity: number;
  platform: string;
  thumbnail?: string;
}

interface ImageMatchGridProps {
  matches: ImageMatch[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

function confidenceBadgeClass(similarity: number): string {
  if (similarity >= 0.8) {
    return 'bg-cyan/90 text-surface';
  }
  if (similarity >= 0.5) {
    return 'bg-acid/90 text-surface';
  }
  return 'bg-fuchsia/90 text-surface';
}

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {['a', 'b', 'c'].map((key) => (
        <div key={key} className="border border-border bg-surface overflow-hidden animate-pulse">
          <div className="aspect-square bg-abyss/70" />
          <div className="p-3 space-y-2">
            <div className="h-3 w-2/3 bg-abyss/80" />
            <div className="h-3 w-full bg-abyss/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ImageMatchGrid({ matches, isLoading = false, error = null, onRetry }: ImageMatchGridProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <div className="animate-spin w-4 h-4 border-2 border-cyan/30 border-t-cyan rounded-full" />
          Checking...
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neon-r/10 border border-neon-r/30 text-neon-r p-4" role="alert">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="px-3 py-1.5 text-xs font-medium bg-neon-r/20 border border-neon-r/40 text-neon-r hover:bg-neon-r/30 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="border border-border bg-surface/60 p-8 text-center">
        <ImageIcon className="w-8 h-8 text-text-mute/50 mx-auto mb-3" />
        <p className="text-sm text-text-dim">No image matches found — try a different image or URL</p>
      </div>
    );
  }

  const groupedByPlatform = matches.reduce<Record<string, ImageMatch[]>>((acc, match) => {
    if (!acc[match.platform]) {
      acc[match.platform] = [];
    }
    acc[match.platform].push(match);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(groupedByPlatform).map(([platform, platformMatches]) => (
        <div key={platform}>
          <h3 className="text-lg font-display font-semibold mb-4 capitalize flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan" />
            {platform} Matches
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {platformMatches.map((match) => (
              <div
                key={`${platform}-${match.url}`}
                className="group bg-surface overflow-hidden border border-border hover:border-cyan/30 transition-all duration-300 hover:shadow-cyan/5"
              >
                <div className="relative aspect-square overflow-hidden bg-abyss">
                  {match.thumbnail ? (
                    <img
                      src={match.thumbnail}
                      alt={`Match from ${platform}`}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-12 h-12 text-text-mute" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <a
                      href={match.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-surface/10 backdrop-blur-md hover:bg-surface/20 rounded-full text-text transition-colors"
                      title="Open image"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  </div>

                  <div className="absolute top-2 left-2">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full backdrop-blur-sm ${confidenceBadgeClass(match.similarity)}`}
                    >
                      {(match.similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="p-3">
                  <p className="text-xs text-text-dim truncate font-mono">{match.url}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

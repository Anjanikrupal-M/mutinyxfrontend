import { useState, useEffect } from 'react';
import { 
  Zap, 
  Instagram, 
  BarChart3, 
  TrendingUp, 
  Users, 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Eye, 
  ArrowRight,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import http from '@/core/http';
import { API } from '@/core/api';
import { toast } from 'sonner';

interface AnalyticsData {
  reel_id: string;
  caption: string;
  posted_at: string;
  permalink: string;
  account: {
    username: string;
    followers: number;
    following: number;
    total_posts: number;
  };
  metrics: {
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    saved: number;
    total_interactions: number;
    engagement_rate: string;
  };
  comments_preview: string[];
  error: string | null;
}

export default function ComposioPage() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reelUrl, setReelUrl] = useState('');
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === 'true') {
      setIsConnected(true);
      setIsCheckingStatus(false);
      window.history.replaceState({}, '', '/composio');
      toast.success('Instagram connected successfully!');
      return; // Critical fix: prevent checkConnectionStatus from running
    } else {
      checkConnectionStatus();
    }
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const response = await http.get(API.composio.connectionStatus);
      setIsConnected(response.data.data.connected);
    } catch (error) {
      console.error('Failed to check connection status', error);
      setIsConnected(false);
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await http.post<{ data: { redirectUrl: string; alreadyConnected?: boolean } }>(
        API.composio.connectInstagram
      );
      
      if (response.data.data.alreadyConnected) {
        setIsConnected(true);
        toast.success('Instagram is already connected!');
        setIsConnecting(false);
        return;
      }

      if (response.data.data.redirectUrl) {
        window.location.href = response.data.data.redirectUrl;
      }
    } catch (error) {
      console.error('Failed to initiate connection', error);
      toast.error('Failed to initiate connection');
      setIsConnecting(false);
    }
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reelUrl) return;

    setIsAnalyzing(true);
    setAnalytics(null);
    try {
      const response = await http.post(API.composio.analyzeReel, { reelUrl });
      if (response.data.data.error) {
        toast.error(response.data.data.error);
      } else {
        setAnalytics(response.data.data);
        toast.success('Analytics fetched successfully!');
      }
    } catch (error) {
      toast.error('Failed to analyze Reel. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isCheckingStatus) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">Checking connection status...</p>
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Zap className="w-8 h-8 text-[#fedc03]" />
            Instagram Reels Analytics
          </h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Powered by Composio Expert Agent
          </p>
        </div>
        
        {isConnected && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full text-sm font-medium border border-green-100">
            Instagram Connected
          </div>
        )}
      </div>

      {!isConnected ? (
        /* Not Connected State */
        <div className="grid md:grid-cols-2 gap-12 items-center py-12">
          <div className="space-y-6">
            <h2 className="text-4xl font-extrabold leading-tight">
              Unlock Deep Insights for <span className="text-[#E1306C]">Instagram Reels</span>
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Connect your Instagram Business or Creator account to start tracking advanced metrics, 
              engagement rates, and audience sentiment with our AI-powered analyst.
            </p>
            
            <ul className="space-y-4">
              {[
                'Real-time Engagement Tracking',
                'Business-level Insights (Reach, Impressions)',
                'Automated Engagement Rate Calculation',
                'Comment Sentiment Analysis Preview'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-lg">
                  <div className="bg-[#fedc03]/20 p-1 rounded-full">
                    <ChevronRight className="w-4 h-4 text-foreground" />
                  </div>
                  {item}
                </li>
              ))}
            </ul>

            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="group relative flex items-center gap-3 px-8 py-4 bg-black text-white rounded-2xl font-bold text-lg hover:bg-neutral-800 transition-all shadow-xl hover:shadow-2xl disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              {isConnecting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Instagram className="w-6 h-6" />
              )}
              Connect via Composio OAuth
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-[#fedc03]/20 to-[#E1306C]/10 rounded-3xl blur-2xl -z-10" />
            <div className="bg-white/40 backdrop-blur-xl border border-white/20 p-8 rounded-3xl shadow-2xl relative overflow-hidden">
               <div className="space-y-6 opacity-40 select-none grayscale">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-neutral-200 rounded-full" />
                    <div className="space-y-2">
                      <div className="w-32 h-4 bg-neutral-200 rounded" />
                      <div className="w-20 h-3 bg-neutral-200 rounded" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="h-24 bg-neutral-100 rounded-2xl" />
                    <div className="h-24 bg-neutral-100 rounded-2xl" />
                  </div>
                  <div className="h-40 bg-neutral-50 rounded-2xl" />
               </div>
               <div className="absolute inset-0 flex items-center justify-center">
                 <div className="bg-white p-6 rounded-2xl shadow-xl border border-neutral-100 flex flex-col items-center text-center max-w-[280px]">
                    <div className="w-16 h-16 bg-[#fedc03] rounded-2xl flex items-center justify-center mb-4 rotate-3">
                      <Zap className="w-10 h-10 text-black" />
                    </div>
                    <h3 className="font-bold text-lg">Integration Required</h3>
                    <p className="text-sm text-muted-foreground mt-2">
                      Connect your account to populate this dashboard with live data.
                    </p>
                 </div>
               </div>
            </div>
          </div>
        </div>
      ) : (
        /* Connected State */
        <div className="space-y-8">
          {/* Search Section */}
          <div className="bg-white/60 backdrop-blur-md border border-white/40 p-8 rounded-3xl shadow-lg ring-1 ring-black/[0.05]">
            <form onSubmit={handleAnalyze} className="max-w-3xl mx-auto space-y-4">
              <label htmlFor="reelUrl" className="block text-sm font-semibold text-neutral-700 ml-1">
                Instagram Reel URL or ID
              </label>
              <div className="relative group">
                <input
                  id="reelUrl"
                  type="text"
                  placeholder="https://www.instagram.com/reel/C6_3X3xS1_z/ or C6_3X3xS1_z"
                  value={reelUrl}
                  onChange={(e) => setReelUrl(e.target.value)}
                  className="w-full px-6 py-4 bg-white border border-neutral-200 rounded-2xl text-lg focus:ring-2 focus:ring-[#fedc03] focus:border-transparent transition-all shadow-sm group-hover:border-neutral-300"
                />
                <button
                  type="submit"
                  disabled={isAnalyzing || !reelUrl}
                  className="absolute right-2 top-2 bottom-2 px-6 bg-black text-white rounded-xl font-bold flex items-center gap-2 hover:bg-neutral-800 disabled:opacity-50 transition-all"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      Analyze
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-muted-foreground ml-1">
                Tip: Ensure the post is public and from a Business or Creator account.
              </p>
            </form>
          </div>

          {analytics && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              {/* Profile and Main Metrics */}
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Account Card */}
                <div className="lg:col-span-1 bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="absolute -inset-2 bg-gradient-to-tr from-[#E1306C] to-[#fedc03] rounded-full animate-spin-slow opacity-20" />
                    <div className="w-24 h-24 bg-neutral-100 rounded-full flex items-center justify-center text-4xl font-bold border-4 border-white shadow-lg">
                      {analytics.account.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-[#E1306C] text-white p-1.5 rounded-full border-2 border-white">
                      <Instagram className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold">@{analytics.account.username}</h3>
                  <div className="mt-6 w-full grid grid-cols-3 gap-2 py-4 border-y border-neutral-50">
                    <div>
                      <div className="text-lg font-bold">{(analytics.account.followers / 1000).toFixed(1)}k</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Followers</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{analytics.account.following}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Following</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold">{analytics.account.total_posts}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Posts</div>
                    </div>
                  </div>
                  <a 
                    href={analytics.permalink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="mt-6 flex items-center gap-2 text-sm font-semibold text-[#E1306C] hover:underline"
                  >
                    View on Instagram <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Engagement Metrics */}
                <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Impressions', value: analytics.metrics.impressions.toLocaleString(), icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Reach', value: analytics.metrics.reach.toLocaleString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Likes', value: analytics.metrics.likes.toLocaleString(), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
                    { label: 'Comments', value: analytics.metrics.comments.toLocaleString(), icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Shares', value: analytics.metrics.shares.toLocaleString(), icon: Share2, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Saved', value: analytics.metrics.saved.toLocaleString(), icon: Bookmark, color: 'text-cyan-600', bg: 'bg-cyan-50' },
                    { label: 'Interactions', value: analytics.metrics.total_interactions.toLocaleString(), icon: Zap, color: 'text-[#fedc03]', bg: 'bg-neutral-900', labelColor: 'text-neutral-400' },
                    { label: 'Engagement Rate', value: analytics.metrics.engagement_rate, icon: BarChart3, color: 'text-white', bg: 'bg-[#E1306C]', labelColor: 'text-pink-100' },
                  ].map((stat, i) => (
                    <div key={i} className={cn("p-5 rounded-3xl shadow-sm border border-neutral-100 flex flex-col justify-between transition-all hover:scale-[1.02]", stat.bg)}>
                      <div className={cn("p-2 rounded-xl w-fit", stat.color.replace('text-', 'bg-').replace('600', '100'))}>
                        <stat.icon className={cn("w-5 h-5", stat.color)} />
                      </div>
                      <div className="mt-4">
                        <div className={cn("text-2xl font-bold tracking-tight", stat.color)}>{stat.value}</div>
                        <div className={cn("text-[10px] uppercase font-bold tracking-widest mt-1", stat.labelColor || 'text-muted-foreground')}>
                          {stat.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Caption and Comments */}
              <div className="grid md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <Zap className="w-5 h-5 text-[#fedc03]" />
                    Caption Analysis
                  </h4>
                  <p className="text-neutral-600 leading-relaxed italic">
                    "{analytics.caption}"
                  </p>
                  <div className="pt-4 border-t border-neutral-50 text-xs text-muted-foreground flex items-center justify-between">
                    <span>Posted on {new Date(analytics.posted_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</span>
                    <span>ID: {analytics.reel_id}</span>
                  </div>
                </div>

                <div className="bg-white p-8 rounded-3xl border border-neutral-100 shadow-xl space-y-4">
                  <h4 className="font-bold flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    Comments Preview
                  </h4>
                  <div className="space-y-3">
                    {analytics.comments_preview.length > 0 ? (
                      analytics.comments_preview.slice(0, 3).map((comment, i) => (
                        <div key={i} className="p-3 bg-neutral-50 rounded-xl text-sm text-neutral-700 border border-neutral-100">
                          {comment}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm py-4 text-center italic">
                        No comments to display.
                      </p>
                    )}
                    {analytics.comments_preview.length > 3 && (
                      <p className="text-[10px] text-center text-muted-foreground font-medium uppercase tracking-widest">
                        + {analytics.comments_preview.length - 3} more comments analyzed by agent
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Empty State / Initial Dashboard */}
          {!analytics && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="bg-neutral-100 p-6 rounded-full">
                <BarChart3 className="w-12 h-12 text-neutral-400" />
              </div>
              <div className="max-w-md">
                <h3 className="text-xl font-bold">Ready to analyze?</h3>
                <p className="text-muted-foreground mt-2">
                  Paste a Reel URL above to generate a full performance report. 
                  Our agent will fetch real-time data directly from the Instagram API.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

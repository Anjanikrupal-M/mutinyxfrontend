import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InstagramInsightsPayload } from '../influencer-display';
import { InstagramInsightsPanel } from './InstagramInsightsPanel';

const fixture: InstagramInsightsPayload = {
  connected: true,
  connectMethod: 'instagram_login',
  lastSyncedAt: '2026-09-16T10:00:00.000Z',
  profile: {
    username: 'creator', displayName: 'Creator', profilePictureUrl: null,
    biography: 'Beauty creator', website: 'https://example.com', followerCount: 3500,
    followsCount: 200, mediaCount: 80, accountType: 'MEDIA_CREATOR',
  },
  performance: {
    engagementRate: 3.2, avgLikes: 20, avgComments: 4, postingFrequency: 2,
    contentMix: { image: 10, video: 8, carousel: 3 }, lastPostDate: '2026-09-15T10:00:00.000Z',
  },
  accountPerformance: {
    period: 'day', since: '2026-08-17', until: '2026-09-16',
    metrics: { views: 3600, reach: 577, total_interactions: 128, saves: 7 },
    breakdowns: [{ metric: 'views', dimension: 'media_product_type', values: { REEL: 636, POST: 1335 } }],
    availability: { status: 'available', collectedAt: '2026-09-16T10:00:00.000Z' },
  },
  audience: {
    followers: {
      countries: { IN: 70, US: 30 },
      age: { '25-34': 60, '18-24': 40 },
      gender: { M: 45, F: 50, U: 5 },
    },
    availability: { status: 'partial', reason: 'below_meta_threshold', collectedAt: '2026-09-16T10:00:00.000Z' },
  },
  topPosts: [],
  summary: {
    followerGrowth30d: 2.5, engagementByReach: 22.18, saveRate: 1.21,
    shareRate: 0.69, topCountry: 'IN', topCity: 'Mumbai', topAgeGroup: '25-34',
  },
  content: [{
    id: 'media-1', format: 'carousel', mediaType: 'CAROUSEL_ALBUM', mediaProductType: 'FEED',
    caption: 'Campaign post', permalink: 'https://instagram.com/p/example', thumbnailUrl: null,
    publishedAt: '2026-09-14T10:00:00.000Z', carouselItemCount: 3,
    metricsCollectedAt: '2026-09-15T10:00:00.000Z', insightsStatus: 'unavailable',
    metrics: {
      views: 500, reach: 400, likes: 30, comments: 3, shares: 2, saves: 4,
      totalInteractions: 39, replies: null, follows: null, averageWatchTimeMs: null,
      totalWatchTimeMs: null, engagementRate: 9.75,
    },
  }],
  scores: { engagementScore: 70, consistencyScore: 85, overallCreatorScore: 75 },
  provenance: {
    source: 'meta_graph', verified: true, graphVersion: 'v25.0',
    collectedAt: '2026-09-16T10:00:00.000Z', status: 'fresh',
  },
  dataCoverage: { level: 'partial', notes: ['Engaged-audience demographics were below Meta privacy thresholds.'] },
};

describe('InstagramInsightsPanel', () => {
  it('renders factual overview, audience, performance, content, and provenance states', () => {
    render(<InstagramInsightsPanel insights={fixture} />);
    const openTab = (name: string) => {
      const tab = screen.getByRole('tab', { name });
      fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
    };

    expect(screen.getByText('Engagement by reach')).toBeInTheDocument();
    expect(screen.getByText('Last 30 days')).toBeInTheDocument();
    expect(screen.getAllByText('LAST 30 DAYS').length).toBeGreaterThan(0);
    expect(screen.getByText('17 Aug 2026 – 16 Sept 2026')).toBeInTheDocument();
    expect(screen.queryByText(/data confidence/i)).not.toBeInTheDocument();
    // Performance is merged into Overview; Trust is gone.
    expect(screen.getByText('From seen to engaged')).toBeInTheDocument();
    expect(screen.getByText('Views by format')).toBeInTheDocument();
    expect(screen.getByText('Reels')).toBeInTheDocument();
    expect(screen.getByText('Feed posts')).toBeInTheDocument();
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Overview', 'Audience', 'Content']);

    openTab('Audience');
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getAllByText('70.0%').length).toBeGreaterThan(0);
    expect(screen.getByText('Male')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('M')).not.toBeInTheDocument();
    expect(screen.queryByText('F')).not.toBeInTheDocument();
    expect(screen.queryByText('U')).not.toBeInTheDocument();

    openTab('Content');
    expect(screen.getByText('Top reels')).toBeInTheDocument();
    expect(screen.getByText('No reels among the creator’s recent posts.')).toBeInTheDocument();
    expect(screen.getByText('Top carousels')).toBeInTheDocument();
    expect(screen.getByText('#1 Carousel')).toBeInTheDocument();
    expect(screen.queryByText('Explore all content by format')).not.toBeInTheDocument();
    expect(screen.getByText(/3 items/)).toBeInTheDocument();
    expect(screen.getByText(/latest refresh unavailable/i)).toBeInTheDocument();

    expect(screen.getByLabelText('Meta verified')).toBeInTheDocument();
  });

  it('hides unavailable content metrics but keeps measured zeroes', () => {
    const reelFixture: InstagramInsightsPayload = {
      ...fixture,
      content: [{
        ...fixture.content![0],
        id: 'reel-1',
        format: 'reel',
        mediaType: 'VIDEO',
        mediaProductType: 'REELS',
        carouselItemCount: 0,
        metrics: {
          ...fixture.content![0].metrics!,
          reach: 0,
          shares: null,
          saves: null,
          engagementRate: null,
        },
      }],
    };
    render(<InstagramInsightsPanel insights={reelFixture} />);
    const contentTab = screen.getByRole('tab', { name: 'Content' });
    fireEvent.mouseDown(contentTab, { button: 0, ctrlKey: false });

    expect(screen.queryByText('Saves')).not.toBeInTheDocument();
    expect(screen.queryByText('Shares')).not.toBeInTheDocument();
    expect(screen.queryByText(/eng\.$/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Reach').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('shows the top three reels and carousels, strongest first', () => {
    const base = fixture.content![0];
    const item = (id: string, format: string, interactions: number) => ({
      ...base, id, format, metrics: { ...base.metrics!, totalInteractions: interactions },
    });
    render(<InstagramInsightsPanel insights={{
      ...fixture,
      content: [
        item('r1', 'reel', 10), item('r2', 'reel', 90), item('r3', 'reel', 40), item('r4', 'reel', 5),
        item('c1', 'carousel', 7), item('c2', 'carousel', 70),
        item('i1', 'feed-image', 999),
      ],
    }} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Content' }), { button: 0, ctrlKey: false });

    const badges = screen.getAllByText(/^#\d (Reel|Carousel)$/).map((node) => node.textContent);
    expect(badges).toEqual(['#1 Reel', '#2 Reel', '#3 Reel', '#1 Carousel', '#2 Carousel']);
  });
});

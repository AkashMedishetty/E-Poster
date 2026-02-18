import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Force dynamic rendering - no caching
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Initialize Upstash Redis client
const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface PresentationData {
  id: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
  fileUrl: string;
  fileType: string;
  localFileName?: string;
  isLocalFile?: boolean;
  localFileData?: string;
}

interface PresentationState {
  abstract: PresentationData | null;
  timestamp: number;
  version: number;
}

// Helper to get room key
function getRoomKey(roomId: string): string {
  return `presentation:${roomId}`;
}

// GET - Retrieve current presentation state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get('room') || 'default';
  const clientVersion = parseInt(searchParams.get('version') || '0', 10);

  try {
    const room = await redis.get<PresentationState>(getRoomKey(roomId));
    
    if (!room) {
      return NextResponse.json({
        changed: clientVersion === 0,
        abstract: null,
        timestamp: Date.now(),
        version: 0,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    // If client already has the latest version, return 304-like response
    if (clientVersion === room.version) {
      return NextResponse.json({
        changed: false,
        version: room.version,
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
    }

    return NextResponse.json({
      changed: true,
      abstract: room.abstract,
      timestamp: room.timestamp,
      version: room.version,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Redis GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch presentation state' },
      { status: 500 }
    );
  }
}

// POST - Update presentation state (from laptop)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, room: roomId = 'default' } = body;
    const roomKey = getRoomKey(roomId);

    // Get current state or create new
    const current = await redis.get<PresentationState>(roomKey);
    const currentVersion = current?.version || 0;

    if (type === 'present_abstract') {
      const newState: PresentationState = {
        abstract: data,
        timestamp: Date.now(),
        version: currentVersion + 1,
      };
      
      // Store with 1 hour expiry (auto-cleanup inactive rooms)
      await redis.set(roomKey, newState, { ex: 3600 });

      return NextResponse.json({
        success: true,
        version: newState.version,
        message: 'Presentation updated',
      });
    }

    if (type === 'close_presentation') {
      const newState: PresentationState = {
        abstract: null,
        timestamp: Date.now(),
        version: currentVersion + 1,
      };
      
      await redis.set(roomKey, newState, { ex: 3600 });

      return NextResponse.json({
        success: true,
        version: newState.version,
        message: 'Presentation closed',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Redis POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

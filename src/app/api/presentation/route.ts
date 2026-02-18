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

  console.log(`[API GET] Room: ${roomId}, Client version: ${clientVersion}`);

  try {
    const room = await redis.get<PresentationState>(getRoomKey(roomId));
    
    console.log(`[API GET] Redis response for ${roomId}:`, room ? `version ${room.version}` : 'null');
    
    if (!room) {
      console.log(`[API GET] No room found, returning empty state`);
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
      console.log(`[API GET] No change, client is up to date`);
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

    console.log(`[API GET] Sending update: version ${room.version}, abstract: ${room.abstract?.title || 'null'}`);
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
    console.error('[API GET] Redis error:', error);
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

    console.log(`[API POST] Type: ${type}, Room: ${roomId}`);

    // Get current state or create new
    const current = await redis.get<PresentationState>(roomKey);
    const currentVersion = current?.version || 0;
    
    console.log(`[API POST] Current version in Redis: ${currentVersion}`);

    if (type === 'present_abstract') {
      const newState: PresentationState = {
        abstract: data,
        timestamp: Date.now(),
        version: currentVersion + 1,
      };
      
      // Store with 1 hour expiry (auto-cleanup inactive rooms)
      await redis.set(roomKey, newState, { ex: 3600 });
      
      console.log(`[API POST] Saved presentation: ${data?.title}, new version: ${newState.version}`);

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
      
      console.log(`[API POST] Closed presentation, new version: ${newState.version}`);

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
    console.error('[API POST] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

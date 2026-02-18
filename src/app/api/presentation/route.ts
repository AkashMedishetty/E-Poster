import { NextRequest, NextResponse } from 'next/server';

// In-memory store for presentation state per room
// Each room is an independent laptop+bigscreen pair
interface PresentationState {
  abstract: PresentationData | null;
  timestamp: number;
  version: number;
}

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

// Room-based state storage (supports multiple independent laptop+bigscreen pairs)
const rooms = new Map<string, PresentationState>();

function getRoom(roomId: string): PresentationState {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, { abstract: null, timestamp: Date.now(), version: 0 });
  }
  return rooms.get(roomId)!;
}

// GET - Retrieve current presentation state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const roomId = searchParams.get('room') || 'default';
  const clientVersion = parseInt(searchParams.get('version') || '0', 10);
  
  const room = getRoom(roomId);
  
  // If client already has the latest version, return 304-like response
  if (clientVersion === room.version) {
    return NextResponse.json({
      changed: false,
      version: room.version,
    });
  }
  
  return NextResponse.json({
    changed: true,
    abstract: room.abstract,
    timestamp: room.timestamp,
    version: room.version,
  });
}

// POST - Update presentation state (from laptop)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data, room: roomId = 'default' } = body;
    
    const room = getRoom(roomId);
    
    if (type === 'present_abstract') {
      room.abstract = data;
      room.timestamp = Date.now();
      room.version++;
      
      return NextResponse.json({
        success: true,
        version: room.version,
        message: 'Presentation updated',
      });
    }
    
    if (type === 'close_presentation') {
      room.abstract = null;
      room.timestamp = Date.now();
      room.version++;
      
      return NextResponse.json({
        success: true,
        version: room.version,
        message: 'Presentation closed',
      });
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid action type' },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

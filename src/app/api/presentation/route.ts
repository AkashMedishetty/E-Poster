import { NextRequest, NextResponse } from 'next/server';

// In-memory store for presentation state
// This works on Vercel because serverless functions share memory within the same instance
// For multi-instance deployments, consider using Vercel KV or a database
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

// Global state (persists across requests within the same serverless instance)
let presentationState: PresentationState = {
  abstract: null,
  timestamp: Date.now(),
  version: 0,
};

// GET - Retrieve current presentation state
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientVersion = parseInt(searchParams.get('version') || '0', 10);
  
  // If client already has the latest version, return 304-like response
  if (clientVersion === presentationState.version) {
    return NextResponse.json({
      changed: false,
      version: presentationState.version,
    });
  }
  
  return NextResponse.json({
    changed: true,
    abstract: presentationState.abstract,
    timestamp: presentationState.timestamp,
    version: presentationState.version,
  });
}

// POST - Update presentation state (from laptop)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;
    
    if (type === 'present_abstract') {
      presentationState = {
        abstract: data,
        timestamp: Date.now(),
        version: presentationState.version + 1,
      };
      
      return NextResponse.json({
        success: true,
        version: presentationState.version,
        message: 'Presentation updated',
      });
    }
    
    if (type === 'close_presentation') {
      presentationState = {
        abstract: null,
        timestamp: Date.now(),
        version: presentationState.version + 1,
      };
      
      return NextResponse.json({
        success: true,
        version: presentationState.version,
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

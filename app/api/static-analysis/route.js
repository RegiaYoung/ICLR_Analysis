import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const staticDataPath = path.join(process.cwd(), 'static-analysis-data');
    
    if (!fs.existsSync(staticDataPath)) {
      return NextResponse.json(
        { error: 'Static analysis data not found' },
        { status: 404 }
      );
    }

    // Load all static analysis data files
    const files = {
      stats: 'stats.json',
      institutionAnalysis: 'institution-analysis.json',
      reviewerAnalysis: 'reviewer-analysis.json',
      qualityAnalysis: 'quality-analysis.json',
      conflictAnalysis: 'conflict-analysis.json',
      institutions: 'institutions.json',
      reviewers: 'reviewers.json'
    };

    const data = {};

    for (const [key, filename] of Object.entries(files)) {
      const filePath = path.join(staticDataPath, filename);
      if (fs.existsSync(filePath)) {
        data[key] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } else {
        data[key] = null;
      }
    }

    return NextResponse.json({
      success: true,
      data,
      metadata: {
        loadedAt: new Date().toISOString(),
        source: 'static_analysis_data',
        dataQuality: 'Pre-generated static analysis data'
      }
    });
    
  } catch (error) {
    console.error('Static analysis data loading error:', error);
    return NextResponse.json(
      { error: 'Failed to load static analysis data', details: error.message },
      { status: 500 }
    );
  }
}
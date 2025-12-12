import { NextResponse } from "next/server";
import { getPool, ensureUserBehaviorTable, ensureAuthTables } from "../../../lib/db";
import { auth } from "../../../lib/auth";
import { headers } from "next/headers";

export async function POST(request) {
  try {
    await ensureAuthTables();
    await ensureUserBehaviorTable();
    
    const headersList = await headers();
    const session = await auth.api.getSession({
      headers: headersList
    });

    const { 
      actionType, 
      actionTarget, 
      actionValue, 
      metadata 
    } = await request.json();

    if (!actionType) {
      return NextResponse.json({ error: "actionType is required" }, { status: 400 });
    }

    // Extract request information
    const userAgent = headersList.get('user-agent') || '';
    const forwarded = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const ipAddress = forwarded?.split(',')[0] || realIp || 'unknown';

    // Generate session ID if not provided (for anonymous users)
    const sessionId = session?.sessionId || 
                     metadata?.sessionId || 
                     `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO user_behaviors (
        user_id, 
        session_id, 
        action_type, 
        action_target, 
        action_value, 
        metadata, 
        user_agent, 
        ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, created_at
    `, [
      session?.user?.id || null,
      sessionId,
      actionType,
      actionTarget || null,
      actionValue || null,
      metadata ? JSON.stringify(metadata) : null,
      userAgent,
      ipAddress === 'unknown' ? null : ipAddress
    ]);

    return NextResponse.json({ 
      success: true, 
      trackingId: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });

  } catch (error) {
    console.error("Error tracking user behavior:", error);
    return NextResponse.json({ error: "Failed to track behavior" }, { status: 500 });
  }
}
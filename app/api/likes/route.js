import { NextResponse } from "next/server";
import { getPool, ensureCommunityTables } from "../../../lib/db";
import { auth } from "../../../lib/auth";
import { headers } from "next/headers";

export async function POST(request) {
  try {
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { target_type, target_id } = await request.json();

    if (!target_type || !target_id) {
      return NextResponse.json({ error: "Target type and ID are required" }, { status: 400 });
    }

    if (!["post", "comment"].includes(target_type)) {
      return NextResponse.json({ error: "Invalid target type" }, { status: 400 });
    }

    const pool = getPool();
    
    // Verify target exists
    const targetTable = target_type === "post" ? "posts" : "comments";
    const targetResult = await pool.query(`SELECT id FROM ${targetTable} WHERE id = $1`, [target_id]);
    if (targetResult.rows.length === 0) {
      return NextResponse.json({ error: `${target_type} not found` }, { status: 404 });
    }

    // Check if like already exists
    const existingLike = await pool.query(`
      SELECT id FROM likes 
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3
    `, [session.user.id, target_type, target_id]);

    if (existingLike.rows.length > 0) {
      // Unlike
      await pool.query(`
        DELETE FROM likes 
        WHERE user_id = $1 AND target_type = $2 AND target_id = $3
      `, [session.user.id, target_type, target_id]);
      
      return NextResponse.json({ liked: false, message: "Like removed" });
    } else {
      // Like
      await pool.query(`
        INSERT INTO likes (user_id, target_type, target_id)
        VALUES ($1, $2, $3)
      `, [session.user.id, target_type, target_id]);
      
      return NextResponse.json({ liked: true, message: "Like added" });
    }
  } catch (error) {
    console.error("Error handling like:", error);
    return NextResponse.json({ error: "Failed to handle like" }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const target_type = searchParams.get("target_type");
    const target_id = searchParams.get("target_id");

    if (!target_type || !target_id) {
      return NextResponse.json({ error: "Target type and ID are required" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT COUNT(*) as count, 
             BOOL_OR(user_id = $1) as user_liked
      FROM likes 
      WHERE target_type = $2 AND target_id = $3
    `, [session.user.id, target_type, target_id]);

    return NextResponse.json({
      count: parseInt(result.rows[0].count),
      userLiked: result.rows[0].user_liked || false
    });
  } catch (error) {
    console.error("Error fetching likes:", error);
    return NextResponse.json({ error: "Failed to fetch likes" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getPool, ensureCommunityTables } from "../../../lib/db";
import { auth } from "../../../lib/auth";
import { headers } from "next/headers";

export async function GET(request) {
  try {
    await ensureCommunityTables();
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId");

    if (!postId) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        c.*,
        COUNT(l.id) as like_count
      FROM comments c
      LEFT JOIN likes l ON l.target_type = 'comment' AND l.target_id = c.id
      WHERE c.post_id = $1
      GROUP BY c.id
      ORDER BY c.created_at ASC
    `, [postId]);

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { post_id, parent_id, content, is_anonymous } = await request.json();

    if (!post_id || !content) {
      return NextResponse.json({ error: "Post ID and content are required" }, { status: 400 });
    }

    const pool = getPool();
    
    // Verify post exists
    const postResult = await pool.query("SELECT id FROM posts WHERE id = $1", [post_id]);
    if (postResult.rows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // If parent_id provided, verify parent comment exists
    if (parent_id) {
      const parentResult = await pool.query("SELECT id FROM comments WHERE id = $1", [parent_id]);
      if (parentResult.rows.length === 0) {
        return NextResponse.json({ error: "Parent comment not found" }, { status: 404 });
      }
    }

    const result = await pool.query(`
      INSERT INTO comments (post_id, parent_id, content, author_id, author_name, is_anonymous)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [
      post_id,
      parent_id || null,
      content,
      session.user.id,
      session.user.name || session.user.email,
      is_anonymous || false
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json({ error: "Failed to create comment" }, { status: 500 });
  }
}
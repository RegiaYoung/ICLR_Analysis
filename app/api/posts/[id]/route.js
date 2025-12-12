import { NextResponse } from "next/server";
import { getPool, ensureCommunityTables } from "../../../../lib/db";
import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";

export async function GET(request, { params }) {
  try {
    await ensureCommunityTables();
    const { id } = params;
    
    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(DISTINCT c.id) as comment_count,
        COUNT(DISTINCT l.id) as like_count
      FROM posts p
      LEFT JOIN comments c ON p.id = c.post_id
      LEFT JOIN likes l ON l.target_type = 'post' AND l.target_id = p.id
      WHERE p.id = $1
      GROUP BY p.id
    `, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = params;
    const { title, content } = await request.json();

    const pool = getPool();
    
    // Check if user owns the post
    const postResult = await pool.query("SELECT author_id FROM posts WHERE id = $1", [id]);
    if (postResult.rows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    
    if (postResult.rows[0].author_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await pool.query(`
      UPDATE posts 
      SET title = $1, content = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [title, content, id]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating post:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { id } = params;
    const pool = getPool();
    
    // Check if user owns the post
    const postResult = await pool.query("SELECT author_id FROM posts WHERE id = $1", [id]);
    if (postResult.rows.length === 0) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }
    
    if (postResult.rows[0].author_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await pool.query("DELETE FROM posts WHERE id = $1", [id]);

    return NextResponse.json({ message: "Post deleted successfully" });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
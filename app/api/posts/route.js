import { NextResponse } from "next/server";
import { getPool, ensureCommunityTables, ensureAuthTables } from "../../../lib/db";
import { auth } from "../../../lib/auth";
import { headers } from "next/headers";

export async function GET(request) {
  try {
    await ensureAuthTables();
    await ensureCommunityTables();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const offset = (page - 1) * limit;

    const pool = getPool();
    const result = await pool.query(`
      SELECT 
        p.*,
        COUNT(c.id) as comment_count,
        COUNT(l.id) as like_count
      FROM posts p
      LEFT JOIN comments c ON p.id = c.post_id
      LEFT JOIN likes l ON l.target_type = 'post' AND l.target_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query("SELECT COUNT(*) as total FROM posts");
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      posts: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    return NextResponse.json({ error: "Failed to fetch posts" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await ensureAuthTables();
    await ensureCommunityTables();
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { title, content, is_anonymous } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "Title and content are required" }, { status: 400 });
    }

    const pool = getPool();
    const result = await pool.query(`
      INSERT INTO posts (title, content, author_id, author_name, is_anonymous)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [
      title,
      content,
      session.user.id,
      session.user.name || session.user.email,
      is_anonymous || false
    ]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("Error creating post:", error);
    return NextResponse.json({ error: "Failed to create post" }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getPool, ensureCommunityTables } from "../../../../lib/db";
import { auth } from "../../../../lib/auth";
import { headers } from "next/headers";

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
    const { content } = await request.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const pool = getPool();
    
    // Check if user owns the comment
    const commentResult = await pool.query("SELECT author_id FROM comments WHERE id = $1", [id]);
    if (commentResult.rows.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    
    if (commentResult.rows[0].author_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await pool.query(`
      UPDATE comments 
      SET content = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [content, id]);

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json({ error: "Failed to update comment" }, { status: 500 });
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
    
    // Check if user owns the comment
    const commentResult = await pool.query("SELECT author_id FROM comments WHERE id = $1", [id]);
    if (commentResult.rows.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }
    
    if (commentResult.rows[0].author_id !== session.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await pool.query("DELETE FROM comments WHERE id = $1", [id]);

    return NextResponse.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 });
  }
}
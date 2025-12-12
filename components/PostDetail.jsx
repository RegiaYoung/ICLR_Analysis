"use client";
import { useState, useEffect } from "react";
import { useSession } from "../lib/auth-client";
import CommentList from "./CommentList";
import CreateComment from "./CreateComment";
import { trackButtonClick } from "../lib/tracking";

export default function PostDetail({ post, onBack }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);

  useEffect(() => {
    fetchComments();
    if (session?.user) {
      fetchLikeStatus();
    }
  }, [post.id, session]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments?postId=${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error("Error fetching comments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLikeStatus = async () => {
    try {
      const response = await fetch(`/api/likes?target_type=post&target_id=${post.id}`);
      if (response.ok) {
        const data = await response.json();
        setLiked(data.userLiked);
        setLikeCount(data.count);
      }
    } catch (error) {
      console.error("Error fetching like status:", error);
    }
  };

  const handleLike = async () => {
    if (!session?.user) return;

    const action = liked ? 'unlike' : 'like';
    trackButtonClick(`post_${action}`, post.id.toString());

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_type: "post",
          target_id: post.id,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLiked(data.liked);
        setLikeCount(prev => data.liked ? prev + 1 : prev - 1);
      }
    } catch (error) {
      console.error("Error handling like:", error);
    }
  };

  const handleCommentCreated = (newComment) => {
    setComments([...comments, newComment]);
    trackButtonClick('comment_created', post.id.toString());
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const displayAuthor = (post) => {
    if (post.is_anonymous) return "Anonymous";
    return post.author_name || "Unknown";
  };

  return (
    <div>
      <button 
        onClick={() => {
          trackButtonClick('back_to_posts', post.id.toString());
          onBack();
        }}
        className="toggle-btn"
        style={{ marginBottom: "20px" }}
      >
        ← Back to Posts
      </button>

      <div className="card" style={{ marginBottom: "20px" }}>
        <h1 style={{ marginBottom: "15px" }}>{post.title}</h1>
        
        <div style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
          By {displayAuthor(post)} • {formatDate(post.created_at)}
          {post.updated_at !== post.created_at && (
            <span> • Edited {formatDate(post.updated_at)}</span>
          )}
        </div>
        
        <div style={{ marginBottom: "20px", lineHeight: "1.6" }}>
          {post.content.split('\n').map((paragraph, index) => (
            <p key={index} style={{ marginBottom: "10px" }}>
              {paragraph}
            </p>
          ))}
        </div>
        
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          borderTop: "1px solid #eee",
          paddingTop: "15px"
        }}>
          <div style={{ display: "flex", gap: "15px", fontSize: "14px", color: "#666" }}>
            <span>{comments.length} comments</span>
            <span>{likeCount} likes</span>
          </div>
          
          {session?.user && (
            <button
              onClick={handleLike}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "18px",
                color: liked ? "#e74c3c" : "#ccc",
                transition: "color 0.2s"
              }}
            >
              ♥ {liked ? "Liked" : "Like"}
            </button>
          )}
        </div>
      </div>

      {session?.user && (
        <CreateComment 
          postId={post.id}
          onCommentCreated={handleCommentCreated}
        />
      )}

      <div style={{ marginTop: "20px" }}>
        <h3>Comments</h3>
        {loading ? (
          <div className="loading">Loading comments...</div>
        ) : (
          <CommentList 
            comments={comments}
            onCommentCreated={handleCommentCreated}
          />
        )}
      </div>
    </div>
  );
}
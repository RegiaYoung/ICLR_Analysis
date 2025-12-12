"use client";
import { useState, useEffect } from "react";
import { useSession } from "../lib/auth-client";

export default function PostList({ posts, onPostClick }) {
  const { data: session } = useSession();
  const [likedPosts, setLikedPosts] = useState(new Set());

  useEffect(() => {
    if (session?.user) {
      // Fetch user's liked posts
      posts.forEach(async (post) => {
        try {
          const response = await fetch(`/api/likes?target_type=post&target_id=${post.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.userLiked) {
              setLikedPosts(prev => new Set([...prev, post.id]));
            }
          }
        } catch (error) {
          console.error("Error fetching like status:", error);
        }
      });
    }
  }, [posts, session]);

  const handleLike = async (e, postId) => {
    e.stopPropagation(); // Prevent opening post detail
    
    if (!session?.user) return;

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_type: "post",
          target_id: postId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          if (data.liked) {
            newSet.add(postId);
          } else {
            newSet.delete(postId);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error handling like:", error);
    }
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

  if (posts.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "40px", color: "#666" }}>
        <p>No posts yet. Be the first to start a discussion!</p>
      </div>
    );
  }

  return (
    <div>
      {posts.map((post) => (
        <div 
          key={post.id} 
          className="card" 
          style={{ 
            marginBottom: "15px", 
            cursor: "pointer",
            transition: "transform 0.2s",
          }}
          onClick={() => onPostClick(post)}
          onMouseEnter={(e) => e.target.style.transform = "scale(1.01)"}
          onMouseLeave={(e) => e.target.style.transform = "scale(1)"}
        >
          <div style={{ marginBottom: "10px" }}>
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px" }}>
              {post.title}
            </h3>
            <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
              By {displayAuthor(post)} • {formatDate(post.created_at)}
            </div>
          </div>
          
          <div style={{ 
            marginBottom: "15px", 
            color: "#555",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: "3",
            WebkitBoxOrient: "vertical"
          }}>
            {post.content}
          </div>
          
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            fontSize: "14px",
            color: "#666"
          }}>
            <div style={{ display: "flex", gap: "15px" }}>
              <span>{post.comment_count || 0} comments</span>
              <span>{post.like_count || 0} likes</span>
            </div>
            
            {session?.user && (
              <button
                onClick={(e) => handleLike(e, post.id)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "18px",
                  color: likedPosts.has(post.id) ? "#e74c3c" : "#ccc",
                  transition: "color 0.2s"
                }}
              >
                ♥
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
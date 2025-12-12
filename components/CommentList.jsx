"use client";
import { useState, useEffect } from "react";
import { useSession } from "../lib/auth-client";
import CreateComment from "./CreateComment";
import { trackButtonClick } from "../lib/tracking";

export default function CommentList({ comments, onCommentCreated }) {
  const { data: session } = useSession();
  const [likedComments, setLikedComments] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [commentLikeCounts, setCommentLikeCounts] = useState({});

  useEffect(() => {
    if (session?.user) {
      // Fetch user's liked comments and like counts
      comments.forEach(async (comment) => {
        try {
          const response = await fetch(`/api/likes?target_type=comment&target_id=${comment.id}`);
          if (response.ok) {
            const data = await response.json();
            if (data.userLiked) {
              setLikedComments(prev => new Set([...prev, comment.id]));
            }
            setCommentLikeCounts(prev => ({
              ...prev,
              [comment.id]: data.count
            }));
          }
        } catch (error) {
          console.error("Error fetching like status:", error);
        }
      });
    }
  }, [comments, session]);

  const handleLike = async (commentId) => {
    if (!session?.user) return;

    const action = likedComments.has(commentId) ? 'unlike' : 'like';
    trackButtonClick(`comment_${action}`, commentId.toString());

    try {
      const response = await fetch("/api/likes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          target_type: "comment",
          target_id: commentId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setLikedComments(prev => {
          const newSet = new Set(prev);
          if (data.liked) {
            newSet.add(commentId);
          } else {
            newSet.delete(commentId);
          }
          return newSet;
        });
        
        setCommentLikeCounts(prev => ({
          ...prev,
          [commentId]: data.liked 
            ? (prev[commentId] || 0) + 1 
            : Math.max(0, (prev[commentId] || 0) - 1)
        }));
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

  const displayAuthor = (comment) => {
    if (comment.is_anonymous) return "Anonymous";
    return comment.author_name || "Unknown";
  };

  const handleReplyCreated = (newComment) => {
    onCommentCreated(newComment);
    trackButtonClick('reply_created', newComment.parent_id?.toString() || 'unknown');
    setReplyingTo(null);
  };

  // Organize comments by thread
  const parentComments = comments.filter(c => !c.parent_id);
  const childComments = comments.filter(c => c.parent_id);
  
  const getChildComments = (parentId) => {
    return childComments.filter(c => c.parent_id === parentId);
  };

  const CommentItem = ({ comment, isReply = false }) => (
    <div 
      className="card" 
      style={{ 
        marginBottom: "10px",
        marginLeft: isReply ? "30px" : "0",
        backgroundColor: isReply ? "#f9f9f9" : "white"
      }}
    >
      <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
        {displayAuthor(comment)} • {formatDate(comment.created_at)}
        {comment.updated_at !== comment.created_at && (
          <span> • Edited</span>
        )}
      </div>
      
      <div style={{ marginBottom: "10px", lineHeight: "1.5" }}>
        {comment.content.split('\n').map((paragraph, index) => (
          <p key={index} style={{ marginBottom: "5px" }}>
            {paragraph}
          </p>
        ))}
      </div>
      
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center",
        fontSize: "12px"
      }}>
        <div style={{ display: "flex", gap: "15px", alignItems: "center" }}>
          <span>{commentLikeCounts[comment.id] || 0} likes</span>
          
          {session?.user && !isReply && (
            <button
              onClick={() => {
                const action = replyingTo === comment.id ? 'cancel_reply' : 'start_reply';
                trackButtonClick(action, comment.id.toString());
                setReplyingTo(replyingTo === comment.id ? null : comment.id);
              }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#666",
                fontSize: "12px",
                textDecoration: "underline"
              }}
            >
              {replyingTo === comment.id ? "Cancel" : "Reply"}
            </button>
          )}
        </div>
        
        {session?.user && (
          <button
            onClick={() => handleLike(comment.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "16px",
              color: likedComments.has(comment.id) ? "#e74c3c" : "#ccc",
              transition: "color 0.2s"
            }}
          >
            ♥
          </button>
        )}
      </div>

      {replyingTo === comment.id && (
        <div style={{ marginTop: "15px" }}>
          <CreateComment
            postId={comment.post_id}
            parentId={comment.id}
            onCommentCreated={handleReplyCreated}
            onCancel={() => setReplyingTo(null)}
          />
        </div>
      )}
    </div>
  );

  if (comments.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
        <p>No comments yet. Be the first to comment!</p>
      </div>
    );
  }

  return (
    <div>
      {parentComments.map((comment) => (
        <div key={comment.id}>
          <CommentItem comment={comment} />
          {getChildComments(comment.id).map((reply) => (
            <CommentItem key={reply.id} comment={reply} isReply={true} />
          ))}
        </div>
      ))}
    </div>
  );
}
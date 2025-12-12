"use client";
import { useState } from "react";
import { trackButtonClick } from "../lib/tracking";

export default function CreateComment({ postId, parentId = null, onCommentCreated, onCancel }) {
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showEmojis, setShowEmojis] = useState(false);

  const commonEmojis = [
    "😀", "😂", "🥰", "😍", "🤔", "👍", "👎", "❤️", 
    "🔥", "💯", "🎉", "😊", "😎", "🤝", "💪", "👏",
    "✅", "❌", "⚡", "🚀", "💡", "🎯", "📈", "🏆"
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!content.trim()) {
      setError("Comment content is required");
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          post_id: postId,
          parent_id: parentId,
          content: content.trim(),
          is_anonymous: isAnonymous,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        onCommentCreated(data);
        setContent("");
        setIsAnonymous(false);
        if (onCancel) onCancel(); // For reply forms
      } else {
        setError(data.error || "Failed to create comment");
      }
    } catch (error) {
      console.error("Error creating comment:", error);
      setError("Failed to create comment");
    } finally {
      setLoading(false);
    }
  };

  const insertEmoji = (emoji) => {
    setContent(content + emoji);
    setShowEmojis(false);
    trackButtonClick('emoji_used', emoji);
  };

  return (
    <div className="card" style={{ marginBottom: "15px" }}>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "15px", position: "relative" }}>
          <textarea
            placeholder={parentId ? "Write your reply..." : "Write a comment..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ddd",
              borderRadius: "4px",
              fontSize: "14px",
              resize: "vertical",
              paddingRight: "45px"
            }}
          />
          <button
            type="button"
            onClick={() => setShowEmojis(!showEmojis)}
            style={{
              position: "absolute",
              right: "8px",
              top: "8px",
              background: "none",
              border: "none",
              fontSize: "18px",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
              lineHeight: 1
            }}
          >
            😀
          </button>
          
          {showEmojis && (
            <div style={{
              position: "absolute",
              top: "100%",
              right: "0",
              background: "var(--color-surface)",
              border: "1px solid var(--color-secondary)",
              borderRadius: "8px",
              padding: "12px",
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              gap: "4px",
              zIndex: 1000,
              boxShadow: "var(--shadow)",
              maxWidth: "280px"
            }}>
              {commonEmojis.map((emoji, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "18px",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "4px",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                  onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.1)"}
                  onMouseLeave={(e) => e.target.style.background = "none"}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginBottom: "15px" }}>
          <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => {
                const newValue = e.target.checked;
                trackButtonClick('comment_anonymous_toggle', newValue ? 'enabled' : 'disabled');
                setIsAnonymous(newValue);
              }}
              style={{ marginRight: "8px" }}
            />
            Comment anonymously
          </label>
        </div>

        {error && (
          <div style={{ color: "red", marginBottom: "15px", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px" }}>
          <button 
            type="submit" 
            className="toggle-btn"
            disabled={loading}
          >
            {loading ? "Posting..." : (parentId ? "Reply" : "Comment")}
          </button>
          {onCancel && (
            <button 
              type="button" 
              className="toggle-btn"
              onClick={() => {
                trackButtonClick('comment_cancel', parentId ? 'reply_cancel' : 'comment_cancel');
                onCancel();
              }}
              style={{ backgroundColor: "#666" }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
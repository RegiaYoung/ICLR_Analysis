"use client";
import { useEffect, useState } from "react";
import { useSession, signInWithGoogle, signInWithGitHub } from "../../lib/auth-client";
import PostList from "../../components/PostList";
import CreatePost from "../../components/CreatePost";
import PostDetail from "../../components/PostDetail";
import UserProfile from "../../components/UserProfile";
import ProfilePage from "../../components/ProfilePage";
import { trackPageView, trackButtonClick, trackAuth, trackLanguageChange, trackThemeChange } from "../../lib/tracking";

export default function CommunityPage() {
  const { data: session, isPending } = useSession();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [lang, setLang] = useState("en");
  const [themeLight, setThemeLight] = useState(false);

  useEffect(() => {
    if (themeLight) document.body.classList.add("light");
    else document.body.classList.remove("light");
  }, [themeLight]);

  const fetchPosts = async () => {
    try {
      const response = await fetch("/api/posts");
      const data = await response.json();
      if (response.ok) {
        setPosts(data.posts);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    trackPageView('community');
    fetchPosts();
  }, []);

  const handlePostCreated = (newPost) => {
    setPosts([newPost, ...posts]);
    setShowCreatePost(false);
    trackButtonClick('post_created', newPost.title);
  };

  const handlePostClick = (post) => {
    setSelectedPost(post);
    trackButtonClick('post_view', post.id.toString());
  };

  const handleBackToList = () => {
    setSelectedPost(null);
    fetchPosts(); // Refresh posts to get updated comment counts
  };

  if (isPending) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <>
      {/* Top Bar */}
      <div className="topbar">
        <button className="toggle-btn" onClick={() => {
          trackButtonClick('nav_home', 'community_topbar');
          window.location.href = '/';
        }}>
          ← Back to Home
        </button>
        <button className="toggle-btn" onClick={() => {
          trackButtonClick('nav_community', 'community_topbar');
          window.location.href = '/community';
        }}>
          Community
        </button>
        {!session && !isPending && (
          <>
            <button className="toggle-btn" onClick={() => {
              trackAuth('login_attempt', 'google');
              signInWithGoogle();
            }}>
              Login with Google
            </button>
            <button className="toggle-btn" onClick={() => {
              trackAuth('login_attempt', 'github');
              signInWithGitHub();
            }}>
              Login with GitHub
            </button>
          </>
        )}
        {isPending && (
          <span className="toggle-btn" style={{opacity: 0.6}}>Loading...</span>
        )}
        <button className="toggle-btn" onClick={() => {
          const newLang = lang === "zh" ? "en" : "zh";
          trackLanguageChange(newLang, lang);
          setLang(newLang);
        }}>
          {lang === "zh" ? "中 / EN" : "EN / 中"}
        </button>
        <button className="toggle-btn" onClick={() => {
          const newTheme = !themeLight;
          trackThemeChange(newTheme ? 'light' : 'dark', themeLight ? 'light' : 'dark');
          setThemeLight(newTheme);
        }}>
          {themeLight ? "Dark mode" : "Light mode"}
        </button>
        {session?.user && <UserProfile user={session.user} onShowProfile={() => setShowProfile(true)} />}
      </div>

      <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }} className="community-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }} className="community-header">
          <h1>Community</h1>
          {session?.user && !selectedPost && (
            <button 
              className="toggle-btn"
              onClick={() => {
                const action = showCreatePost ? 'cancel_post' : 'new_post';
                trackButtonClick(action, 'create_post_toggle');
                setShowCreatePost(!showCreatePost);
              }}
              style={{ minWidth: "100px" }}
            >
              {showCreatePost ? "Cancel" : "New Post"}
            </button>
          )}
        </div>

      {!session && !isPending && (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>Please log in to participate in the community discussions.</p>
        </div>
      )}

      {selectedPost ? (
        <PostDetail 
          post={selectedPost} 
          onBack={handleBackToList}
        />
      ) : (
        <>
          {showCreatePost && session?.user && (
            <CreatePost 
              onPostCreated={handlePostCreated}
              onCancel={() => setShowCreatePost(false)}
            />
          )}
          
          {loading ? (
            <div className="loading">Loading posts...</div>
          ) : (
            <PostList 
              posts={posts} 
              onPostClick={handlePostClick}
            />
          )}
        </>
      )}
      </div>

      {/* Profile Modal */}
      {showProfile && session?.user && (
        <ProfilePage 
          user={session.user} 
          onClose={() => setShowProfile(false)} 
        />
      )}
    </>
  );
}
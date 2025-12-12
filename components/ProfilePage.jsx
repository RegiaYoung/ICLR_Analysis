import { useState } from "react";
import { signOut } from "../lib/auth-client";

export default function ProfilePage({ show, user, onClose }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || "");

  const handleSave = () => {
    // TODO: Implement save functionality
    alert("Save functionality coming soon...");
    setIsEditing(false);
  };

  const handleSignOut = async () => {
    await signOut();
    window.location.reload();
  };

  if (!show || !user) return null;

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profile-header">
          <h2>Profile</h2>
          <button className="close-btn" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="profile-content">
          <div className="profile-avatar-section">
            {user.image ? (
              <img src={user.image} alt="Profile" className="profile-avatar-large" />
            ) : (
              <div className="profile-avatar-placeholder">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="currentColor">
                  <path d="M32 28a12 12 0 1 0 0-24 12 12 0 0 0 0 24ZM56 48a24 24 0 1 0-48 0h48Z"/>
                </svg>
              </div>
            )}
          </div>

          <div className="profile-info">
            <div className="profile-field">
              <label>Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="profile-input"
                />
              ) : (
                <span className="profile-value">{user.name || "Not set"}</span>
              )}
            </div>

            <div className="profile-field">
              <label>Email</label>
              <span className="profile-value">{user.email}</span>
              <span className="profile-note">Email cannot be changed</span>
            </div>

            <div className="profile-field">
              <label>Member Since</label>
              <span className="profile-value">
                {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US') : "Unknown"}
              </span>
            </div>
          </div>

          <div className="profile-actions">
            {isEditing ? (
              <>
                <button className="profile-btn primary" onClick={handleSave}>
                  Save Changes
                </button>
                <button className="profile-btn secondary" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="profile-btn primary" onClick={() => setIsEditing(true)}>
                Edit Profile
              </button>
            )}
            
            <button className="profile-btn danger" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
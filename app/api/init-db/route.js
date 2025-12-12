const { ensureAuthTables, ensureCommunityTables, ensureUserBehaviorTable, cleanupOldTables } = require("../../../lib/db");

export async function GET() {
  try {
    // Clean up old tables
    await cleanupOldTables();
    
    // Initialize all database tables
    await ensureAuthTables();
    await ensureCommunityTables();
    await ensureUserBehaviorTable();
    
    return Response.json({ 
      success: true,
      message: "Database tables initialized successfully",
      tables: [
        "user (Better Auth users)",
        "session (Better Auth sessions)", 
        "account (OAuth provider accounts)",
        "verification (Email verification tokens)",
        "posts (Community posts)",
        "comments (Community comments)",
        "likes (Community likes)",
        "user_behaviors (User behavior tracking)"
      ]
    });
  } catch (error) {
    console.error("Error initializing database:", error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
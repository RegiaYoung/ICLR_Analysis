import { authHandlers } from "../../../../lib/auth";
import { ensureAuthTables } from "../../../../lib/db";

// Ensure auth tables exist when the auth API is first called
let tablesInitialized = false;

async function initializeTablesOnce() {
  if (!tablesInitialized) {
    try {
      await ensureAuthTables();
      tablesInitialized = true;
      console.log('✅ Auth database tables initialized');
    } catch (error) {
      console.error('❌ Error initializing auth tables:', error);
    }
  }
}

// Wrap the original handlers to ensure database initialization
export async function GET(request, context) {
  await initializeTablesOnce();
  return authHandlers.GET(request, context);
}

export async function POST(request, context) {
  await initializeTablesOnce();
  return authHandlers.POST(request, context);
}

export async function PUT(request, context) {
  await initializeTablesOnce();
  return authHandlers.PUT(request, context);
}

export async function PATCH(request, context) {
  await initializeTablesOnce();
  return authHandlers.PATCH(request, context);
}

export async function DELETE(request, context) {
  await initializeTablesOnce();
  return authHandlers.DELETE(request, context);
}

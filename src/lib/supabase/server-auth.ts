import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

type AuthSuccess = {
  client: SupabaseClient;
  user: User;
};

type AuthResult = AuthSuccess | { error: NextResponse };

function readBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export async function requireAuthenticatedClient(
  request: NextRequest
): Promise<AuthResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      error: NextResponse.json(
        { error: "Supabase environment variables are not configured." },
        { status: 500 }
      ),
    };
  }

  const token = readBearerToken(request);
  if (!token) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Missing bearer token." },
        { status: 401 }
      ),
    };
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  return { client, user: data.user };
}

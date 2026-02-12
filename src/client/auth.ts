import type { Protocol } from "./protocol.ts";

const LOGIN_URL = "https://auth.iqoption.com/api/v2/login";

interface LoginResult {
  ssid: string;
}

/** Login via HTTP to obtain the ssid token */
export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: email, password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { data?: { ssid?: string } };
  const ssid = data?.data?.ssid;

  if (!ssid) {
    // Try extracting from set-cookie
    const cookies = res.headers.get("set-cookie") || "";
    const match = cookies.match(/ssid=([^;]+)/);
    if (match) {
      return { ssid: match[1]! };
    }
    throw new Error("No ssid in login response or cookies");
  }

  return { ssid };
}

/** Authenticate the WebSocket connection using the ssid */
export async function authenticateWs(
  protocol: Protocol,
  ssid: string,
): Promise<string> {
  const response = await protocol.send("authenticate", {
    ssid,
    protocol: 3,
    session_id: "",
    client_session_id: "",
  });

  if (response.msg !== true && (response.msg as Record<string, unknown>)?.isSuccessful !== true) {
    throw new Error(`WS authentication failed: ${JSON.stringify(response)}`);
  }

  const clientSessionId =
    (response as unknown as Record<string, unknown>).client_session_id as string || "";
  console.log("[Auth] Authenticated successfully");
  return clientSessionId;
}

import { BrowserWindow, session } from "electron";
import keytar from "keytar";
import fetch from "node-fetch";

const CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const REDIRECT_URI = "http://localhost/callback"; // must match your GitHub OAuth app

interface GitHubTokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
}

export async function loginWithGitHub(): Promise<void> {
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&scope=read:user`;

  const code = await openOAuthWindow(authUrl, REDIRECT_URI);
  const token = await exchangeCodeForToken(code);

  if (!token.access_token) {
    console.error("❌ No access_token returned from GitHub OAuth exchange.");
    return;
  }

  await keytar.setPassword("BROS", "github", token.access_token);
  console.log("✅ Token stored in keychain");
}

async function openOAuthWindow(authUrl: string, redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      width: 600,
      height: 800,
      webPreferences: { nodeIntegration: false },
    });
    
    win.loadURL(authUrl);

    const filter = { urls: [redirectUri + "*"] };

    session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
      const url = new URL(details.url);
      const code = url.searchParams.get("code");
      if (code) {
        resolve(code);
        win.close();
        // 🧹 cleanup
        session.defaultSession.webRequest.onBeforeRequest(filter, () => {});
      }
      callback({ cancel: false });
    });

    win.on("closed", () => reject(new Error("Window closed before login completed")));
  });
}

async function exchangeCodeForToken(code: string): Promise<GitHubTokenResponse> {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
    }),
  });

  const data = (await response.json()) as GitHubTokenResponse;
  return data;
}

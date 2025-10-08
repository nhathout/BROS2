"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginWithGitHub = loginWithGitHub;
const electron_1 = require("electron");
const keytar_1 = __importDefault(require("keytar"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost/callback"; // must match your GitHub OAuth app
async function loginWithGitHub() {
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=read:user`;
    const code = await openOAuthWindow(authUrl, REDIRECT_URI);
    const token = await exchangeCodeForToken(code);
    if (!token.access_token) {
        console.error("❌ No access_token returned from GitHub OAuth exchange.");
        return;
    }
    await keytar_1.default.setPassword("BROS", "github", token.access_token);
    console.log("✅ Token stored in keychain");
}
async function openOAuthWindow(authUrl, redirectUri) {
    return new Promise((resolve, reject) => {
        const win = new electron_1.BrowserWindow({
            width: 600,
            height: 800,
            webPreferences: { nodeIntegration: false },
        });
        win.loadURL(authUrl);
        const filter = { urls: [redirectUri + "*"] };
        electron_1.session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
            const url = new URL(details.url);
            const code = url.searchParams.get("code");
            if (code) {
                resolve(code);
                win.close();
                // 🧹 cleanup
                electron_1.session.defaultSession.webRequest.onBeforeRequest(filter, () => { });
            }
            callback({ cancel: false });
        });
        win.on("closed", () => reject(new Error("Window closed before login completed")));
    });
}
async function exchangeCodeForToken(code) {
    const response = await (0, node_fetch_1.default)("https://github.com/login/oauth/access_token", {
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
    const data = (await response.json());
    return data;
}

/**
 * Google Drive Integration Service
 * Handles OAuth2 flow, file upload, folder management for AudioNotes Pro
 */

import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

// Google OAuth2 endpoints
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_API = "https://www.googleapis.com/drive/v3";
const GOOGLE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  createdTime?: string;
}

export interface DriveFolder {
  id: string;
  name: string;
}

/**
 * Generate Google OAuth2 authorization URL
 */
export function getGoogleAuthUrl(
  clientId: string,
  redirectUri: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/drive.appdata",
    ].join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeGoogleCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token exchange failed: ${err}`);
  }

  const data = await res.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/**
 * Refresh Google access token using refresh token
 */
export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google token refresh failed: ${err}`);
  }

  const data = await res.json() as { access_token: string; expires_in: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

/**
 * Get a valid access token for a user (refreshes if expired)
 */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.googleAccessToken || !user?.googleRefreshToken) return null;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  // Check if token is expired (with 5min buffer)
  const now = new Date();
  const expiry = user.googleTokenExpiry;
  const isExpired = !expiry || expiry.getTime() - now.getTime() < 5 * 60 * 1000;

  if (isExpired) {
    try {
      const { accessToken, expiresIn } = await refreshGoogleToken(
        user.googleRefreshToken,
        clientId,
        clientSecret,
      );
      const newExpiry = new Date(Date.now() + expiresIn * 1000);
      await db.update(users)
        .set({ googleAccessToken: accessToken, googleTokenExpiry: newExpiry })
        .where(eq(users.id, userId));
      return accessToken;
    } catch {
      return null;
    }
  }

  return user.googleAccessToken;
}

/**
 * Create or find the AudioNotes Pro folder in Google Drive
 */
export async function getOrCreateAudioNotesFolder(
  accessToken: string,
  folderName = "AudioNotes Pro",
): Promise<DriveFolder> {
  // Search for existing folder
  const searchRes = await fetch(
    `${GOOGLE_DRIVE_API}/files?q=name='${encodeURIComponent(folderName)}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json() as { files: DriveFolder[] };
    if (data.files && data.files.length > 0) {
      return data.files[0]!;
    }
  }

  // Create new folder
  const createRes = await fetch(`${GOOGLE_DRIVE_API}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Failed to create Google Drive folder: ${err}`);
  }

  const folder = await createRes.json() as DriveFolder;
  return folder;
}

/**
 * Upload audio file to Google Drive via multipart upload
 */
export async function uploadToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  audioBase64: string,
  mimeType: string,
): Promise<DriveFile> {
  const audioBuffer = Buffer.from(audioBase64, "base64");

  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const boundary = "audio_upload_boundary_audionotes";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
    ),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);

  const res = await fetch(
    `${GOOGLE_UPLOAD_API}/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": body.length.toString(),
      },
      body,
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Google Drive upload failed: ${err}`);
  }

  return res.json() as Promise<DriveFile>;
}

/**
 * List files in a Drive folder
 */
export async function listDriveFiles(
  accessToken: string,
  folderId: string,
): Promise<DriveFile[]> {
  const res = await fetch(
    `${GOOGLE_DRIVE_API}/files?q='${folderId}' in parents and trashed=false&fields=files(id,name,mimeType,size,webViewLink,createdTime)&orderBy=createdTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return [];
  const data = await res.json() as { files: DriveFile[] };
  return data.files || [];
}

/**
 * Delete a file from Drive
 */
export async function deleteDriveFile(
  accessToken: string,
  fileId: string,
): Promise<void> {
  await fetch(`${GOOGLE_DRIVE_API}/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

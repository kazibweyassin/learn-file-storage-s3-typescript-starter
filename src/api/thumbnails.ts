import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import path from "path";

const MAX_UPLOAD_SIZE = 10 << 20; // 10MB in bytes

/**
 * Map MIME types to file extensions
 */
function getFileExtension(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpeg",
    // "image/gif": "gif",
    // "image/webp": "webp",
    // "image/svg+xml": "svg",
  };
  
  return mimeToExt[mimeType] || "jpg";
}

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  if (!video.thumbnailURL) {
    throw new NotFoundError("Thumbnail not found");
  }

  // Redirect to the static file server
  return Response.redirect(video.thumbnailURL, 302);
}

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };

  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  // Get video metadata from database
  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  // Check if user owns the video
  if (video.userID !== userID) {
    throw new UserForbiddenError("You don't own this video");
  }

  if (req.method === "POST") {
    // Step 1: Parse form data
    const formData = await req.formData();
    const thumbnail = formData.get("thumbnail");

    // Step 2: Validate thumbnail exists
    if (!thumbnail) {
      throw new BadRequestError("Missing thumbnail");
    }

    // Step 3: Check if it's a File instance
    if (!(thumbnail instanceof File)) {
      throw new BadRequestError("Thumbnail must be a file");
    }

    // Step 4: Validate file size
    if (thumbnail.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestError("File size exceeds 10MB limit");
    }

    // Step 5: Get and validate media type
    const mediaType = thumbnail.type;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(mediaType)) {
      throw new BadRequestError("Thumbnail must be PNG or JPEG");
    }

    // Step 6: Read file data into ArrayBuffer
    const data = await thumbnail.arrayBuffer();

    // Step 7: Determine file extension from MIME type
    const fileExtension = getFileExtension(mediaType);

    // Step 8: Create file path using videoId and extension
    const filename = `${videoId}.${fileExtension}`;
    const filePath = path.join(cfg.assetsRoot, filename);

    // Step 9: Write file to disk using Bun.write
    await Bun.write(filePath, data);

    console.log(`Thumbnail saved to: ${filePath}`);

    // Step 10: Generate thumbnail URL (served by file server in index.ts)
    const thumbnailURL = `http://localhost:${cfg.port}/assets/${filename}`;

    // Step 11: Update video metadata with thumbnail URL
    video.thumbnailURL = thumbnailURL;
    updateVideo(cfg.db, video);

    // Step 12: Return updated video metadata
    return respondWithJSON(200, video);
  }

  throw new BadRequestError("Method not allowed");
}
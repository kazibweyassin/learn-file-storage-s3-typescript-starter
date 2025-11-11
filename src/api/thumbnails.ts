import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

const videoThumbnails: Map<string, Thumbnail> = new Map();
const MAX_UPLOAD_SIZE = 10 << 20; // 10MB in bytes

export async function handlerGetThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Couldn't find video");
  }

  const thumbnail = videoThumbnails.get(videoId);
  if (!thumbnail) {
    throw new NotFoundError("Thumbnail not found");
  }

  return new Response(thumbnail.data, {
    headers: {
      "Content-Type": thumbnail.mediaType,
      "Cache-Control": "no-store",
    },
  });
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
    if (!mediaType.startsWith("image/")) {
      throw new BadRequestError("Thumbnail must be an image file");
    }

    // Step 6: Read file data into ArrayBuffer
    const data = await thumbnail.arrayBuffer();

    // Step 7: Save thumbnail to global map
    videoThumbnails.set(videoId, {
      data,
      mediaType,
    });

    // Step 8: Generate thumbnail URL
    const thumbnailURL = `http://localhost:${cfg.port}/upload/thumbnails/${videoId}`;

    // Step 9: Update video metadata with thumbnail URL
    video.thumbnailURL = thumbnailURL;
    updateVideo(cfg.db, video);

    // Step 10: Return updated video metadata
    return respondWithJSON(200, video);
  }

  throw new BadRequestError("Method not allowed");
}
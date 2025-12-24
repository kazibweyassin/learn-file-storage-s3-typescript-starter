import { respondWithJSON } from "./json";

import { cfg, type ApiConfig } from "../config";
import { write, type BunRequest } from "bun";
import { validateJWT } from "../auth";
import { getBearerToken } from "../auth";
import { BadRequestError } from "./errors";
import { rm  } from "bun";

const MAX_UPLOAD_SIZE = 1 << 30; // 1GB in bytes

export async function handlerUploadVideo(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  const uuidvid = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!videoId || !uuidvid.test(videoId)) {
    return respondWithJSON(400, { error: "Invalid video ID" });
  }

    // Extract the token from the Authorization header
    const token = getBearerToken(req.headers);
    const userID = validateJWT(token, cfg.jwtSecret);

    // Get video metadata from the database
    // (Assume you have getVideo imported from your db/videos module)
    const { getVideo } = await import("../db/videos");
    const video = getVideo(cfg.db, videoId);
    if (!video) {
      return respondWithJSON(404, { error: "Video not found" });
    }
    // If the user is not the owner, throw UserForbiddenError
    if (video.userID !== userID) {
      const { UserForbiddenError } = await import("./errors");
      throw new UserForbiddenError("You don't own this video");
    }
    // Continue with upload logic...
    // Additional logic for handling video upload can be added here
    // For now, just return the userID and videoId for demonstration

    const formData = await req.formData();
    const videoFile = formData.get("video");

    if (!videoFile) {
      throw new BadRequestError("Missing video file");
    }
    if (!(videoFile instanceof File)) {
      throw new BadRequestError("Video must be a file");
    }
    if (videoFile.size > MAX_UPLOAD_SIZE) {
      throw new BadRequestError("Video file is too large");
    }
    // CHECK MIME TYPE MP4
    if (videoFile.type !== "video/mp4") {
      throw new BadRequestError("Only MP4 video files are allowed");
    }
    // Save to a temporary file in a temp directory
    const tempFilePath = `${cfg.filepathRoot}/temp/${videoId}.mp4`;
    const data = await videoFile.arrayBuffer();
    await write(tempFilePath, new Uint8Array(data));

    // Generate a random 32-byte hex string for the S3 key
    const { randomBytes } = await import("crypto");
    const randomHex = randomBytes(16).toString("hex"); // 32 hex chars
    const key = `${randomHex}.mp4`;

    // Read the file from the temporary path
    const fileBody = await Bun.file(tempFilePath).arrayBuffer();
    const contentType = "video/mp4";

    // Upload to S3
    const { uploadToS3 } = await import("./s3Client");
    const buffer = Buffer.from(fileBody);
    const s3Url = await uploadToS3(buffer, key, contentType);    await rm(tempFilePath);

    // Update the video record in the database with the S3 URL
    // S3 URL format: https://<bucket-name>.s3.<region>.amazonaws.com/<key>
    const bucket = process.env.AWS_S3_BUCKET_NAME!;
    const region = process.env.AWS_REGION!;
    const videoS3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    // Update the video object and save to DB
    video.videoURL = videoS3Url;
    const { updateVideo } = await import("../db/videos");
    updateVideo(cfg.db, video);

    // Return the S3 URL as the video URL
    return respondWithJSON(200, { message: "Video uploaded successfully", videoId, videoURL: videoS3Url });
}

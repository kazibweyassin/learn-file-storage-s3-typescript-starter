import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { handlerUploadThumbnail, handlerGetThumbnail } from "./thumbnails";
import { BadRequestError, UserForbiddenError, NotFoundError } from "./errors";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import * as authModule from "../auth";
import * as videosModule from "../db/videos";

// ==================== Test Setup ====================

let mockConfig: ApiConfig;
let mockDb: any;

beforeEach(() => {
  // Create mock database
  mockDb = {
    prepare: mock(() => ({
      run: mock(() => ({})),
      get: mock(() => ({})),
      all: mock(() => []),
    })),
  };

  // Create mock config
  mockConfig = {
    db: mockDb,
    jwtSecret: "test-secret",
    port: 8091,
  };

  // Clear any stored thumbnails between tests
  // Note: You'll need to export videoThumbnails from thumbnails.ts for this
  // For now, we'll work around it
});

afterEach(() => {
  // Clean up mocks
  mock.restore();
});

// ==================== Helper Functions ====================

function createMockRequest(
  videoId: string,
  method: string,
  file?: File,
  token: string = "valid-token"
): BunRequest {
  return {
    method,
    params: { videoId },
    headers: new Headers({
      Authorization: `Bearer ${token}`,
    }),
    formData: async () => {
      const fd = new FormData();
      if (file) {
        fd.append("thumbnail", file);
      }
      return fd;
    },
    url: `http://localhost:8091/upload/thumbnails/${videoId}`,
  } as unknown as BunRequest;
}

function createImageFile(sizeInBytes: number, name: string = "test.png"): File {
  return new File(
    [new ArrayBuffer(sizeInBytes)],
    name,
    { type: "image/png" }
  );
}

function createPdfFile(sizeInBytes: number = 1024): File {
  return new File(
    [new ArrayBuffer(sizeInBytes)],
    "doc.pdf",
    { type: "application/pdf" }
  );
}

// ==================== Tests ====================

describe("Thumbnail Upload Handler", () => {
  
  describe("Authentication & Authorization", () => {
    
    test("should reject request without token", async () => {
      // Mock getBearerToken to return null (no token)
      mock.module("../auth", () => ({
        getBearerToken: mock(() => null),
        validateJWT: mock(),
      }));

      const req = createMockRequest("test-video-id", "POST", createImageFile(1024), "");

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow();
    });

    test("should reject request with invalid token", async () => {
      // Mock getBearerToken to return token, but validateJWT throws
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "invalid-token"),
        validateJWT: mock(() => {
          throw new Error("Invalid token");
        }),
      }));

      const req = createMockRequest("test-video-id", "POST", createImageFile(1024));

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow();
    });

    test("should reject upload from non-owner", async () => {
      // Mock successful authentication
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"), // Returns user ID
      }));

      // Mock getVideo to return video owned by different user
      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-456", // Different user!
          thumbnailURL: null,
        })),
        updateVideo: mock(),
      }));

      const req = createMockRequest(
        "test-video-id",
        "POST",
        createImageFile(1024)
      );

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(UserForbiddenError);
    });
  });

  describe("File Validation", () => {
    
    beforeEach(() => {
      // Mock successful authentication for all file validation tests
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"),
      }));

      // Mock getVideo to return video owned by authenticated user
      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123", // Same user as authenticated
          thumbnailURL: null,
        })),
        updateVideo: mock(),
      }));
    });

    test("should reject files larger than 10MB", async () => {
      const largeFile = createImageFile(11 * 1024 * 1024); // 11MB
      const req = createMockRequest("test-video-id", "POST", largeFile);

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });

    test("should accept files exactly 10MB", async () => {
      const exactFile = createImageFile(10 * 1024 * 1024); // Exactly 10MB
      const req = createMockRequest("test-video-id", "POST", exactFile);

      // Should NOT throw
      const result = await handlerUploadThumbnail(mockConfig, req);
      expect(result).toBeDefined();
    });

    test("should reject non-image files", async () => {
      const pdfFile = createPdfFile();
      const req = createMockRequest("test-video-id", "POST", pdfFile);

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });

    test("should reject request without file", async () => {
      const req = createMockRequest("test-video-id", "POST"); // No file

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });

    test("should accept valid image types", async () => {
      const imageTypes = [
        { type: "image/png", ext: "png" },
        { type: "image/jpeg", ext: "jpg" },
        { type: "image/gif", ext: "gif" },
        { type: "image/webp", ext: "webp" },
      ];

      for (const { type, ext } of imageTypes) {
        const file = new File(
          [new ArrayBuffer(1024)],
          `test.${ext}`,
          { type }
        );
        const req = createMockRequest("test-video-id", "POST", file);

        const result = await handlerUploadThumbnail(mockConfig, req);
        expect(result).toBeDefined();
      }
    });
  });

  describe("Successful Upload", () => {
    
    let updateVideoMock: any;

    beforeEach(() => {
      // Mock authentication
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"),
      }));

      // Mock database operations
      updateVideoMock = mock();
      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123",
          thumbnailURL: null,
        })),
        updateVideo: updateVideoMock,
      }));
    });

    test("should successfully upload valid thumbnail", async () => {
      const imageFile = createImageFile(1024);
      const req = createMockRequest("test-video-id", "POST", imageFile);

      const response = await handlerUploadThumbnail(mockConfig, req);

      // Check response structure
      expect(response).toBeDefined();
      expect(response.status).toBe(200);

      // Parse JSON response
      const body = await response.json();
      expect(body.id).toBe("test-video-id");
      expect(body.thumbnailURL).toContain("/upload/thumbnails/test-video-id");

      // Verify updateVideo was called
      expect(updateVideoMock).toHaveBeenCalledTimes(1);
    });

    test("should update video metadata in database", async () => {
      const imageFile = createImageFile(1024);
      const req = createMockRequest("test-video-id", "POST", imageFile);

      await handlerUploadThumbnail(mockConfig, req);

      // Verify updateVideo was called with correct arguments
      expect(updateVideoMock).toHaveBeenCalledWith(
        mockConfig.db,
        expect.objectContaining({
          id: "test-video-id",
          thumbnailURL: expect.stringContaining("/upload/thumbnails/test-video-id"),
        })
      );
    });

    test("should store thumbnail in memory for retrieval", async () => {
      const imageFile = createImageFile(1024);
      const uploadReq = createMockRequest("test-video-id", "POST", imageFile);

      // Upload thumbnail
      await handlerUploadThumbnail(mockConfig, uploadReq);

      // Now try to get it
      const getReq = createMockRequest("test-video-id", "GET");
      const response = await handlerGetThumbnail(mockConfig, getReq);

      expect(response).toBeDefined();
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
    });
  });

  describe("Thumbnail Retrieval", () => {
    
    beforeEach(() => {
      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123",
          thumbnailURL: "http://localhost:8091/upload/thumbnails/test-video-id",
        })),
        updateVideo: mock(),
      }));
    });

    test("should return 404 for non-existent thumbnail", async () => {
      const req = createMockRequest("non-existent-video", "GET");

      await expect(
        handlerGetThumbnail(mockConfig, req)
      ).rejects.toThrow(NotFoundError);
    });

    test("should return 404 for video without thumbnail", async () => {
      // Mock getVideo to return video without thumbnail uploaded
      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123",
          thumbnailURL: null,
        })),
      }));

      const req = createMockRequest("test-video-id", "GET");

      await expect(
        handlerGetThumbnail(mockConfig, req)
      ).rejects.toThrow(NotFoundError);
    });

    test("should set correct Content-Type header", async () => {
      // First upload a thumbnail
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"),
      }));

      const imageFile = createImageFile(1024);
      const uploadReq = createMockRequest("test-video-id", "POST", imageFile);
      await handlerUploadThumbnail(mockConfig, uploadReq);

      // Then retrieve it
      const getReq = createMockRequest("test-video-id", "GET");
      const response = await handlerGetThumbnail(mockConfig, getReq);

      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("HTTP Method Validation", () => {
    
    beforeEach(() => {
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"),
      }));

      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123",
          thumbnailURL: null,
        })),
        updateVideo: mock(),
      }));
    });

    test("should reject GET requests to upload endpoint", async () => {
      const req = createMockRequest("test-video-id", "GET");

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });

    test("should reject PUT requests to upload endpoint", async () => {
      const req = createMockRequest("test-video-id", "PUT", createImageFile(1024));

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });

    test("should reject DELETE requests to upload endpoint", async () => {
      const req = createMockRequest("test-video-id", "DELETE");

      await expect(
        handlerUploadThumbnail(mockConfig, req)
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("Edge Cases", () => {
    
    beforeEach(() => {
      mock.module("../auth", () => ({
        getBearerToken: mock(() => "valid-token"),
        validateJWT: mock(() => "user-123"),
      }));

      mock.module("../db/videos", () => ({
        getVideo: mock(() => ({
          id: "test-video-id",
          title: "Test Video",
          userID: "user-123",
          thumbnailURL: null,
        })),
        updateVideo: mock(),
      }));
    });

    test("should handle empty file", async () => {
      const emptyFile = createImageFile(0);
      const req = createMockRequest("test-video-id", "POST", emptyFile);

      // Should succeed (0 bytes is valid, just empty image)
      const response = await handlerUploadThumbnail(mockConfig, req);
      expect(response).toBeDefined();
    });

    test("should handle file exactly at size limit", async () => {
      const maxFile = createImageFile(10 * 1024 * 1024); // Exactly 10MB
      const req = createMockRequest("test-video-id", "POST", maxFile);

      const response = await handlerUploadThumbnail(mockConfig, req);
      expect(response).toBeDefined();
    });

    test("should handle special characters in video ID", async () => {
      const videoId = "test-video-123-abc_def";
      const imageFile = createImageFile(1024);
      const req = createMockRequest(videoId, "POST", imageFile);

      const response = await handlerUploadThumbnail(mockConfig, req);
      const body = await response.json();
      expect(body.thumbnailURL).toContain(videoId);
    });

    test("should overwrite existing thumbnail", async () => {
      const imageFile1 = createImageFile(1024);
      const req1 = createMockRequest("test-video-id", "POST", imageFile1);

      // Upload first thumbnail
      await handlerUploadThumbnail(mockConfig, req1);

      // Upload second thumbnail (should overwrite)
      const imageFile2 = createImageFile(2048);
      const req2 = createMockRequest("test-video-id", "POST", imageFile2);
      const response = await handlerUploadThumbnail(mockConfig, req2);

      expect(response).toBeDefined();
      
      // Verify the new thumbnail is stored
      const getReq = createMockRequest("test-video-id", "GET");
      const getResponse = await handlerGetThumbnail(mockConfig, getReq);
      const buffer = await getResponse.arrayBuffer();
      expect(buffer.byteLength).toBe(2048); // Should be new file size
    });
  });
});
import type { BunRequest } from "bun";
import type { ApiConfig } from "../config";
import {
  BadRequestError,
  NotFoundError,
  UserForbiddenError,
  UserNotAuthenticatedError,
} from "./errors";
import { respondWithJSON } from "./json";

type HandlerWithConfig = (cfg: ApiConfig, req: BunRequest) => Promise<Response>;

// At the top of middleware.ts
type RateLimitInfo = {
  count: number;
  resetTime: number;
};

const rateLimitStore = new Map<string, RateLimitInfo>();

export function rateLimitMiddleware(
  maxRequests: number,
  windowMs: number
) {
  return async function checkRateLimit(userId: string): Promise<void> {
    // TODO: Implement based on your pseudocode above
    
    // Hint for Step 1:
    const now = Date.now();
    
    // Hint for Step 2:
    let userLimit = rateLimitStore.get(userId);
    if (!userLimit) {
      // What should you do here?
      userLimit = { count: 0, resetTime: now + windowMs };
      rateLimitStore.set(userId, userLimit);
    }
    
    // Hint for Step 3:
    if (now > userLimit.resetTime) {
      // What should you do here?
      userLimit.count = 0;
      userLimit.resetTime = now + windowMs;
    }
    
    // Continue implementing...
    // Hint for Step 4:
    if (userLimit.count >= maxRequests) {
      throw new UserForbiddenError(
        `Rate limit exceeded. Try again in ${Math.ceil(
          (userLimit.resetTime - now) / 1000,
        )} seconds.`,
      );
    }

    // Hint for Step 5:
    userLimit.count += 1;
    rateLimitStore.set(userId, userLimit);
    return;

    // step 6: return remainng requests and reset time


  }
}


export function withConfig(cfg: ApiConfig, handler: HandlerWithConfig) {
  return (req: BunRequest) => handler(cfg, req);
}

export function cacheMiddleware(
  next: (req: Request) => Response | Promise<Response>,
): (req: Request) => Promise<Response> {
  return async function (req: Request): Promise<Response> {
    const res = await next(req);
    const headers = new Headers(res.headers);
    headers.set("Cache-Control", "max-age=3600");

    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}

export function errorHandlingMiddleware(
  cfg: ApiConfig,
  err: unknown,
): Response {
  let statusCode = 500;
  let message = "Something went wrong on our end";

  if (err instanceof BadRequestError) {
    statusCode = 400;
    message = err.message;
  } else if (err instanceof UserNotAuthenticatedError) {
    statusCode = 401;
    message = err.message;
  } else if (err instanceof UserForbiddenError) {
    statusCode = 403;
    message = err.message;
  } else if (err instanceof NotFoundError) {
    statusCode = 404;
    message = err.message;
  }

  if (statusCode >= 500) {
    const errStr = errStringFromError(err);
    if (cfg.platform === "dev") {
      message = errStr;
    }
    console.log(errStr);
  }

  return respondWithJSON(statusCode, { error: message });
}

function errStringFromError(err: unknown) {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return "An unknown error occurred";
}


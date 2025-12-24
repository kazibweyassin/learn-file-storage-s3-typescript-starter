const FILE_SIGNATURES = {
    PNG: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
    JPEG: [0xFF, 0xD8, 0xFF],
    GIF87a: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    GIF89a: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
    JPEG_EXIF: [0xFF, 0xD8, 0xFF, 0xE1],
    JPEG_JFIF: [0xFF, 0xD8, 0xFF, 0xE0],
    JPEG_GENERIC: [0xFF, 0xD8, 0xFF],
    MP4: [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
} as const;


/**
 * YOUR TASK 1: Read first N bytes from a file
 * 
 * Hint: 
 * 1. Use file.arrayBuffer() to get binary data
 * 2. Convert to Uint8Array
 * 3. Return first numBytes as array
 */

export function matchesSignature(
  fileBytes: number[],
  signature: readonly number[]
): boolean {
  if (fileBytes.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (fileBytes[i] !== signature[i]) {
      return false;
    }
  }
  return true;
} 

 export function isJPEGFile(signature: number[]): boolean {
  return (
    matchesSignature(signature, FILE_SIGNATURES.JPEG) ||
    matchesSignature(signature, FILE_SIGNATURES.JPEG_EXIF) ||
    matchesSignature(signature, FILE_SIGNATURES.JPEG_JFIF) ||
    matchesSignature(signature, FILE_SIGNATURES.JPEG_GENERIC) 
  );
}

 export function isPNGFile(signature: number[]): boolean {
  return matchesSignature(signature, FILE_SIGNATURES.PNG);
}

 export function validateImageSignature(signature: number[]): boolean {
  return isJPEGFile(signature) || isPNGFile(signature);
}



export async function readFileSignature(
    file: File,
    numBytes: number    
): Promise<number[]> {
     const arrayBuffer = await file.arrayBuffer();
     const uint8Array = new Uint8Array(arrayBuffer);
     return Array.from(uint8Array.slice(0, numBytes));
}


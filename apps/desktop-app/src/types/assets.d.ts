// Declarations for media assets so TS can import them directly from src/assets
declare module "*.mp4" {
  const src: string;
  export default src;
}

declare module "*.webm" {
  const src: string;
  export default src;
}

declare module "*.mov" {
  const src: string;
  export default src;
}

// Allow any other static import fallback
declare module "*";

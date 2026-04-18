declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string;
    EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY: string;
    EXPO_PUBLIC_GOOGLE_PLACES_KEY: string;
  }
}

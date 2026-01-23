/**
 * Type definition for authenticated request with user information
 * Used by JwtAuthGuard to attach user data to request
 */
export interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    username: string;
  };
}

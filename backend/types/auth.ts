// types/auth.ts
import { JwtPayload } from "jsonwebtoken";

export interface AuthPayload extends JwtPayload {
  id: string;
}
import jwt, { JwtPayload } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_ACCESS_SECRET;
const JWT_REFRESH = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH) {
  throw new Error('JWT_SECRET is not defined');
}

// create new tokens
export const createTokens = (id: string, email: string, name: string) => {
  const AccessToken = jwt.sign(
    { id, email, name },
    JWT_SECRET,
    { expiresIn: '3h' }
  );

  const RefreshToken = jwt.sign(
    { id, email, name },
    JWT_REFRESH,
    { expiresIn: '7d' }
  );

  return { AccessToken, RefreshToken };
};

// refresh token
export const recreateRefreshToken = (token: string) => {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH) as JwtPayload;

    const payload = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
    };

    const AccessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: '3h',
    });

    const RefreshToken = jwt.sign(payload, JWT_REFRESH, {
      expiresIn: '7d',
    });

    return { AccessToken, RefreshToken };
  } catch (error) {
    throw new Error('Invalid token');
  }
};
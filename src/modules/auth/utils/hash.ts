import bcrypt from 'bcryptjs';

export const hash = async (password: string): Promise<string> => {
  return bcrypt.hash(password, 10);
};

export const compare = async (password: string, hashedPassword: string): Promise<boolean> => {
  return bcrypt.compare(password, hashedPassword);
};
'use server';


import { prisma } from '@/lib/prisma';
import { loginSchema } from './schema';
import { compare } from 'bcryptjs';

export const authorize = async (args: { email: string; password: string }) => {
  const { email, password } = loginSchema.parse(args);

  const user = await prisma.authUser.findUnique({
    where: { email },
  });

  if (!user || user.deletedBy) {
    throw new Error('User not found');
  }

  const isValid = await compare(password, user.password);

  if (!isValid) {
    throw new Error('Invalid password');
  }

  const { password: _password, ...safeUser } = user;

  return safeUser;
};
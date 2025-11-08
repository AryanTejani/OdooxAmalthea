// Re-export functions from auth.repo.ts for backward compatibility
export {
  findUserByEmail,
  findUserById,
  createUser,
  getUserWithoutPassword,
} from '../auth/auth.repo';


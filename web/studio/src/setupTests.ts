import '@testing-library/jest-dom';
// Mock environment variables to avoid import.meta.env in tests
jest.mock('./shared/lib/env', () => ({
  API_BASE_URL: 'http://localhost:3000',
}));

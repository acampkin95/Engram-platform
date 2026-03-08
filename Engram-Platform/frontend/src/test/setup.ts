import '@testing-library/jest-dom';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers between tests to avoid state pollution
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());

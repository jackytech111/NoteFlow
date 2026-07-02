export const resetAllMocks = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  resetAllMocks();
});

let _ctr = 0;
export const generateId = (): string =>
  Date.now().toString(36) + (++_ctr).toString(36) + Math.random().toString(36).slice(2, 5);

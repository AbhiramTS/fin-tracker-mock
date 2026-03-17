let _c = 0;
export const generateId = () =>
	Date.now().toString(36) + (++_c).toString(36) + Math.random().toString(36).slice(2, 5);
